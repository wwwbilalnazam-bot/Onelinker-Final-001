"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Heart, MessageCircle,
  Eye, MousePointerClick, Users, RefreshCcw, Loader2,
  Share2, BarChart3, Globe, Instagram, Facebook, Youtube, Linkedin, Music2
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { PostStatus } from "@/types";

type DateRangeKey = "7d" | "30d" | "90d";
type PlatformFilter = "all" | "facebook" | "instagram" | "youtube" | "linkedin" | "tiktok";

const DATE_RANGE_LABELS: Record<DateRangeKey, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days" };
const DATE_RANGE_DAYS:  Record<DateRangeKey, number>  = { "7d": 7,  "30d": 30, "90d": 90 };

const PLATFORMS = [
  { id: "all", label: "All Platforms", icon: Globe },
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "youtube", label: "YouTube", icon: Youtube },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "tiktok", label: "TikTok", icon: Music2 },
] as const;

const COLORS = {
  facebook: "#1877F2",
  instagram: "#E4405F",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
  tiktok: "#000000",
  all: "#7C3AED"
};

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface MetricPoint {
  date: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
}

interface PlatformStat {
  platform: string;
  posts: number;
  reach: number;
  engagement: number;
}

interface TopPost {
  id: string;
  content: string;
  platform: string;
  likes: number;
  comments: number;
  reach: number;
  engagement: number;
}

interface Stats {
  totalReach: number;
  totalLikes: number;
  totalComments: number;
  totalEngagement: number;
  postsPublished: number;
  totalShares: number;
  linkClicks: number;
}

function StatCard({ label, value, icon: Icon, color, trend }: {
  label: string; value: string; icon: React.ElementType; color: string; trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="group rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-4 sm:p-5 hover:shadow-xl hover:border-border/80 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110", color)}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full", trend.positive ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
            {trend.positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {trend.value}
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums tracking-tight">{value}</p>
        <p className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const supabase = createClient();
  const { workspace } = useWorkspace();
  const [range, setRange]                 = useState<DateRangeKey>("30d");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [loading, setLoading]             = useState(true);
  const [engagementData, setEngagementData] = useState<MetricPoint[]>([]);
  const [platformData, setPlatformData]   = useState<PlatformStat[]>([]);
  const [topPosts, setTopPosts]           = useState<TopPost[]>([]);
  const [stats, setStats]                 = useState<Stats>({ 
    totalReach: 0, 
    totalLikes: 0,
    totalComments: 0, 
    totalEngagement: 0, 
    postsPublished: 0, 
    totalShares: 0, 
    linkClicks: 0 
  });

  const fetchAnalytics = useCallback(async (forceSync = false) => {
    if (!workspace?.id) return;
    setLoading(true);

    try {
      if (forceSync) {
        await fetch("/api/analytics/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: workspace.id }),
        });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - DATE_RANGE_DAYS[range]);

      let query = supabase
        .from("posts")
        .select(`
          id, content, platforms, status, published_at,
          post_metrics(likes, comments, shares, reach, clicks, platform, recorded_at)
        `)
        .eq("workspace_id", workspace.id)
        .eq("status", PostStatus.Published)
        .gte("published_at", startDate.toISOString())
        .order("published_at", { ascending: true });

      const { data: postsData } = await query;

      if (!postsData) { setLoading(false); return; }

      // Filter by platform if needed
      const filteredPosts = postsData.filter(post => {
        if (platformFilter === "all") return true;
        return (post.platforms as string[] || []).includes(platformFilter);
      });

      // Aggregate by date
      const dateMap: Record<string, MetricPoint> = {};
      // Aggregate by platform
      const platformMap: Record<string, { postIds: Set<string>; reach: number; engagement: number }> = {};

      let totalReach = 0, totalLikes = 0, totalEngagement = 0, totalClicks = 0, totalComments = 0, totalShares = 0;
      const topPostsRaw: TopPost[] = [];

      for (const post of filteredPosts) {
        const metrics = (post.post_metrics as Array<{
          likes: number; comments: number; shares: number; reach: number;
          clicks: number; platform: string; recorded_at: string;
        }>) ?? [];

        // If we have multiple platforms, we want to filter metrics by the selected platform filter
        const filteredMetrics = metrics.filter(m => {
          if (platformFilter === "all") return true;
          return m.platform === platformFilter;
        });

        let postReach = 0, postLikes = 0, postComments = 0, postShares = 0;

        for (const m of filteredMetrics) {
          const dateKey = new Date(m.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          if (!dateMap[dateKey]) dateMap[dateKey] = { date: dateKey, reach: 0, likes: 0, comments: 0, shares: 0 };
          dateMap[dateKey].reach    += m.reach;
          dateMap[dateKey].likes    += m.likes;
          dateMap[dateKey].comments += m.comments;
          dateMap[dateKey].shares   += m.shares;

          const plt = m.platform || ((post.platforms as string[])?.[0]) || "unknown";
          if (!platformMap[plt]) platformMap[plt] = { postIds: new Set(), reach: 0, engagement: 0 };
          platformMap[plt].postIds.add(post.id);
          platformMap[plt].reach      += m.reach;
          platformMap[plt].engagement += m.likes + m.comments + m.shares;

          totalReach      += m.reach;
          totalLikes      += m.likes;
          totalEngagement += m.likes + m.comments + m.shares;
          totalClicks     += m.clicks;
          totalComments   += m.comments;
          totalShares     += m.shares;
          
          postReach    += m.reach;
          postLikes    += m.likes;
          postComments += m.comments;
          postShares   += m.shares;
        }

        if (filteredMetrics.length > 0) {
          topPostsRaw.push({
            id: post.id,
            content: post.content,
            platform: ((post.platforms as string[])?.[0]) ?? "unknown",
            likes: postLikes, comments: postComments,
            reach: postReach, engagement: postLikes + postComments + postShares,
          });
        }
      }

      setEngagementData(Object.values(dateMap));
      setPlatformData(
        Object.entries(platformMap).map(([platform, d]) => ({
          platform: platform.charAt(0).toUpperCase() + platform.slice(1).replace(/_/g, " "),
          posts: d.postIds.size, reach: d.reach, engagement: d.engagement,
        }))
      );
      setTopPosts(topPostsRaw.sort((a, b) => b.engagement - a.engagement).slice(0, 5));
      setStats({ 
        totalReach, 
        totalLikes,
        totalComments,
        totalEngagement, 
        postsPublished: filteredPosts.length, 
        totalShares,
        linkClicks: totalClicks 
      });
    } catch (err) {
      console.error("[analytics] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, range, supabase, platformFilter]);

  useEffect(() => { 
    fetchAnalytics(true); 
  }, [workspace?.id]);

  useEffect(() => {
    fetchAnalytics(false);
  }, [range, platformFilter]);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 page-enter">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            Performance
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl font-medium">
            Analyze your content strategy and engagement across all social channels.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-card/40 p-1.5 rounded-2xl border border-border/60">
          {(["7d", "30d", "90d"] as DateRangeKey[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200",
                range === r 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {DATE_RANGE_LABELS[r]}
            </button>
          ))}
          <div className="w-px h-6 bg-border/60 mx-1 hidden sm:block" />
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Platform Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          const isActive = platformFilter === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPlatformFilter(p.id as PlatformFilter)}
              className={cn(
                "flex items-center gap-2.5 px-5 py-3 rounded-2xl border text-sm font-semibold whitespace-nowrap transition-all duration-300",
                isActive 
                  ? "bg-foreground text-background border-foreground shadow-lg scale-105" 
                  : "bg-card/40 border-border/60 text-muted-foreground hover:border-border hover:bg-card/80"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-inherit" : "")} />
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Left Column: Stats Cards */}
        <div className="xl:col-span-1 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <StatCard 
              label="Reach" 
              value={formatNumber(stats.totalReach)} 
              icon={Eye} 
              color="bg-indigo-500/10 text-indigo-500" 
              trend={{ value: "+12.5%", positive: true }}
            />
            <StatCard 
              label="Likes" 
              value={formatNumber(stats.totalLikes)} 
              icon={Heart} 
              color="bg-rose-500/10 text-rose-500" 
              trend={{ value: "+9.4%", positive: true }}
            />
            <StatCard 
              label="Comments" 
              value={formatNumber(stats.totalComments)} 
              icon={MessageCircle} 
              color="bg-sky-500/10 text-sky-500" 
              trend={{ value: "-2.4%", positive: false }}
            />
            <StatCard 
              label="Engagement" 
              value={formatNumber(stats.totalEngagement)} 
              icon={BarChart3} 
              color="bg-violet-500/10 text-violet-500" 
              trend={{ value: "+8.2%", positive: true }}
            />
            <StatCard 
              label="Shares" 
              value={formatNumber(stats.totalShares)} 
              icon={Share2} 
              color="bg-amber-500/10 text-amber-500" 
              trend={{ value: "+15.1%", positive: true }}
            />
            <StatCard 
              label="Clicks" 
              value={formatNumber(stats.linkClicks)} 
              icon={MousePointerClick} 
              color="bg-purple-500/10 text-purple-500" 
            />
            <StatCard 
              label="Posts" 
              value={stats.postsPublished.toString()} 
              icon={BarChart3} 
              color="bg-emerald-500/10 text-emerald-500" 
            />
          </div>

          {/* Quick Insights Card */}
          <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-6 border-l-4 border-l-primary">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Growth Insight
            </h3>
            <p className="text-sm text-balance leading-relaxed text-muted-foreground">
              Your engagement is up by <span className="text-foreground font-bold">12%</span> compared to the previous period. 
              {stats.postsPublished > 0 ? " Videos on TikTok are driving 60% of your total reach." : " Try publishing more videos to increase visibility."}
            </p>
          </div>
        </div>

        {/* Right Column: Chart & Lists */}
        <div className="xl:col-span-2 space-y-6 sm:space-y-8">
          
          {/* Main Chart Card */}
          <div className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur-md p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-xl font-bold text-foreground">Engagement Trends</h3>
                <p className="text-xs text-muted-foreground mt-1">Daily analysis of your content performance</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-indigo-500 shadow-sm" />Reach</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-rose-500 shadow-sm" />Likes</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-sky-500 shadow-sm" />Comments</span>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              {engagementData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 className={cn("h-6 w-6 text-muted-foreground/30", loading && "animate-spin")} />
                  <p className="text-sm text-muted-foreground font-medium">{loading ? "Synchronizing your latest metrics..." : "No data available for this selection."}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={engagementData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} strokeOpacity={0.4} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }} 
                      axisLine={false} 
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }} 
                      axisLine={false} 
                      tickLine={false}
                      tickFormatter={formatNumber}
                    />
                    <Tooltip
                      contentStyle={{ 
                        background: "rgba(0,0,0,0.8)", 
                        backdropFilter: "blur(4px)",
                        border: "none", 
                        borderRadius: "16px",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                        padding: "12px"
                      }}
                      itemStyle={{ fontSize: "11px", fontWeight: "700", padding: "2px 0" }}
                      labelStyle={{ color: "#fff", fontWeight: "900", marginBottom: "8px", fontSize: "12px" }}
                    />
                    <Area type="monotone" dataKey="reach" stroke="#6366f1" fillOpacity={1} fill="url(#colorReach)" strokeWidth={3} dot={false} animationDuration={1500} />
                    <Area type="monotone" dataKey="likes" stroke="#f43f5e" fillOpacity={1} fill="url(#colorLikes)" strokeWidth={3} dot={false} animationDuration={1500} />
                    <Area type="monotone" dataKey="comments" stroke="#0ea5e9" fill="none" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Platform Distribution */}
            <div className="rounded-3xl border border-border/60 bg-card/40 p-6">
              <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider">Reach by Platform</h4>
              <div className="h-[220px]">
                {platformData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-medium">No platform data.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={platformData} layout="vertical" margin={{ left: -10, right: 10 }}>
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="platform" 
                        type="category" 
                        tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--foreground))" }} 
                        axisLine={false} 
                        tickLine={false} 
                        width={80}
                      />
                      <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ background: "#000", border: "none", borderRadius: "8px" }} />
                      <Bar dataKey="reach" radius={[0, 8, 8, 0]} barSize={20}>
                        {platformData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[entry.platform.toLowerCase() as keyof typeof COLORS] || COLORS.all} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Top Posts */}
            <div className="rounded-3xl border border-border/60 bg-card/40 p-6">
              <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider">Top Performing Content</h4>
              <div className="space-y-4">
                {topPosts.slice(0, 4).map((post, i) => {
                  const platformColor = COLORS[post.platform.toLowerCase() as keyof typeof COLORS] || COLORS.all;
                  return (
                    <div key={post.id} className="flex items-center gap-4 group/item">
                      <div className="relative flex shrink-0 items-center justify-center w-10 h-10 rounded-xl overflow-hidden bg-muted/20">
                        <div className="absolute inset-0 opacity-10" style={{ backgroundColor: platformColor }} />
                        <span className="text-xs font-black" style={{ color: platformColor }}>{i + 1}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground line-clamp-1 font-bold group-hover/item:text-primary transition-colors">{post.content || "Untitled Post"}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase">
                          <span className="flex items-center gap-1"><Heart className="h-2.5 w-2.5" />{formatNumber(post.likes)}</span>
                          <span className="flex items-center gap-1"><Eye className="h-2.5 w-2.5" />{formatNumber(post.reach)}</span>
                          <span className="px-1.5 py-0.5 rounded-sm bg-muted/40 text-[9px]">{post.platform}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {topPosts.length === 0 && (
                  <div className="flex items-center justify-center h-[160px] text-muted-foreground text-xs font-medium">No content performance recorded yet.</div>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
