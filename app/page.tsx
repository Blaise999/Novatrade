'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Play,
  BookOpen,
  Award,
  Clock,
  Star,
  ChevronRight,
  ArrowRight,
  Video,
  Users,
  TrendingUp,
  Target,
  Zap,
  X,
  CheckCircle
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

// Real trading video content - YouTube embeds
const videoLessons = [
  {
    id: 'intro-trading',
    title: 'Introduction to Trading',
    description: 'Learn the basics of financial markets and how trading works',
    duration: '15:42',
    category: 'Beginner',
    thumbnail: '📊',
    youtubeId: 'Xn7KWR9EOGQ',
    views: '2.4M',
    free: true,
  },
  {
    id: 'candlestick-basics',
    title: 'Candlestick Patterns Explained',
    description: 'Master reading candlestick charts like a professional trader',
    duration: '22:18',
    category: 'Technical',
    thumbnail: '📈',
    youtubeId: 'C3KRwfj9F8Q',
    views: '1.8M',
    free: true,
  },
  {
    id: 'support-resistance',
    title: 'Support & Resistance Levels',
    description: 'Identify key price levels for better entry and exit points',
    duration: '18:30',
    category: 'Technical',
    thumbnail: '📉',
    youtubeId: 'MqLGOjTYqjM',
    views: '956K',
    free: true,
  },
  {
    id: 'forex-basics',
    title: 'Forex Trading for Beginners',
    description: 'Complete guide to currency trading and the forex market',
    duration: '28:45',
    category: 'Forex',
    thumbnail: '💱',
    youtubeId: 'iOTvuHUinu0',
    views: '3.2M',
    free: true,
  },
  {
    id: 'risk-management',
    title: 'Risk Management Strategies',
    description: 'Protect your capital with professional risk management',
    duration: '24:12',
    category: 'Advanced',
    thumbnail: '🛡️',
    youtubeId: '7y9o2xkl4Yk',
    views: '1.1M',
    free: true,
  },
  {
    id: 'moving-averages',
    title: 'Moving Averages Strategy',
    description: 'How to use SMA, EMA and other moving averages',
    duration: '19:55',
    category: 'Technical',
    thumbnail: '📊',
    youtubeId: 'lAq96T8FkTw',
    views: '780K',
    free: true,
  },
  {
    id: 'psychology',
    title: 'Trading Psychology Mastery',
    description: 'Control your emotions and develop a winning mindset',
    duration: '32:10',
    category: 'Psychology',
    thumbnail: '🧠',
    youtubeId: 'F63R2j5pXVk',
    views: '2.1M',
    free: true,
  },
  {
    id: 'rsi-indicator',
    title: 'RSI Indicator Tutorial',
    description: 'Use RSI to identify overbought and oversold conditions',
    duration: '16:28',
    category: 'Technical',
    thumbnail: '📈',
    youtubeId: '_f5h8J4TMHs',
    views: '650K',
    free: true,
  },
  {
    id: 'price-action',
    title: 'Price Action Trading',
    description: 'Trade without indicators using pure price action',
    duration: '35:40',
    category: 'Advanced',
    thumbnail: '🎯',
    youtubeId: 'QhDN0ljPJQQ',
    views: '1.5M',
    free: true,
  },
  {
    id: 'stock-basics',
    title: 'Stock Market Investing 101',
    description: 'Everything you need to know about stock investing',
    duration: '26:15',
    category: 'Stocks',
    thumbnail: '🏢',
    youtubeId: 'ZCFkWDdmXG8',
    views: '4.1M',
    free: true,
  },
  {
    id: 'crypto-trading',
    title: 'Cryptocurrency Trading Guide',
    description: 'How to trade Bitcoin, Ethereum and other cryptos',
    duration: '29:50',
    category: 'Crypto',
    thumbnail: '₿',
    youtubeId: 'Yb6825iv0Vk',
    views: '2.8M',
    free: true,
  },
  {
    id: 'chart-patterns',
    title: 'Chart Patterns Every Trader Should Know',
    description: 'Head & shoulders, triangles, flags and more',
    duration: '27:33',
    category: 'Technical',
    thumbnail: '📐',
    youtubeId: 'FkrpUaGThTQ',
    views: '1.3M',
    free: true,
  },
];

const categories = ['All', 'Beginner', 'Technical', 'Forex', 'Stocks', 'Crypto', 'Advanced', 'Psychology'];

export default function AcademyPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [playingVideo, setPlayingVideo] = useState<typeof videoLessons[0] | null>(null);

  const filteredVideos = selectedCategory === 'All' 
    ? videoLessons 
    : videoLessons.filter(v => v.category === selectedCategory);

  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-electric/10 border border-electric/20 rounded-full mb-6">
              <GraduationCap className="w-4 h-4 text-electric" />
              <span className="text-electric text-sm font-medium">Free Trading Education</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Trading Academy
              <br />
              <span className="gradient-text-gold">Learn to Trade</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Watch professional trading tutorials and master the markets. 
              All videos are free and designed to take you from beginner to pro.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: 'Video Lessons', value: '50+', icon: Video },
              { label: 'Hours of Content', value: '25+', icon: Clock },
              { label: 'Students Learning', value: '100K+', icon: Users },
              { label: 'Average Rating', value: '4.9★', icon: Star },
            ].map((stat, index) => (
              <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
                <stat.icon className="w-6 h-6 text-gold mx-auto mb-2" />
                <p className="text-2xl font-bold text-cream">{stat.value}</p>
                <p className="text-sm text-cream/50">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === category
                    ? 'bg-gold text-void'
                    : 'bg-white/5 text-cream/70 hover:bg-white/10'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Video Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16">
            {filteredVideos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden hover:border-white/20 transition-all group cursor-pointer"
                onClick={() => setPlayingVideo(video)}
              >
                {/* Thumbnail */}
                <div className="relative h-40 bg-gradient-to-br from-charcoal to-void flex items-center justify-center">
                  <span className="text-5xl">{video.thumbnail}</span>
                  <div className="absolute inset-0 bg-void/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-16 h-16 bg-gold rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform">
                      <Play className="w-7 h-7 text-void ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-void/80 backdrop-blur-sm rounded text-xs text-cream font-mono">
                    {video.duration}
                  </div>
                  <div className="absolute top-2 left-2 px-2 py-1 bg-profit rounded text-xs text-void font-medium">
                    FREE
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-cream/70">{video.category}</span>
                    <span className="text-xs text-cream/50">{video.views} views</span>
                  </div>
                  <h3 className="text-sm font-semibold text-cream mb-1 line-clamp-2">{video.title}</h3>
                  <p className="text-xs text-cream/50 line-clamp-2">{video.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Learning Path */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 mb-16">
            <h2 className="text-2xl font-bold text-cream mb-8 text-center">Recommended Learning Path</h2>
            <div className="grid md:grid-cols-5 gap-4">
              {[
                { step: 1, title: 'Basics', desc: 'Learn fundamentals', icon: BookOpen },
                { step: 2, title: 'Charts', desc: 'Read price action', icon: TrendingUp },
                { step: 3, title: 'Indicators', desc: 'Technical analysis', icon: Target },
                { step: 4, title: 'Risk', desc: 'Manage your capital', icon: Zap },
                { step: 5, title: 'Practice', desc: 'Start trading', icon: Award },
              ].map((item, index) => (
                <div key={item.step} className="text-center relative">
                  <div className="w-14 h-14 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <item.icon className="w-7 h-7 text-gold" />
                  </div>
                  <div className="text-xs text-gold mb-1">Step {item.step}</div>
                  <h3 className="text-cream font-medium text-sm">{item.title}</h3>
                  <p className="text-xs text-cream/50">{item.desc}</p>
                  {index < 4 && (
                    <ChevronRight className="absolute right-0 top-6 w-5 h-5 text-cream/20 hidden md:block -mr-2" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center bg-gradient-to-r from-gold/10 to-electric/10 rounded-2xl border border-gold/20 p-10">
            <h2 className="text-2xl font-bold text-cream mb-4">Ready to Start Trading?</h2>
            <p className="text-cream/60 mb-6 max-w-xl mx-auto">
              Put your knowledge into practice. Create your free account and start trading with as little as $10.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
              >
                Create Free Account
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/dashboard/trade/stocks"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-cream font-semibold rounded-xl hover:bg-white/20 transition-all"
              >
                Try Demo Trading
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Video Player Modal */}
      <AnimatePresence>
        {playingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/95 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => setPlayingVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-charcoal rounded-2xl border border-white/10 overflow-hidden max-w-5xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Video Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div>
                  <h3 className="text-lg font-semibold text-cream">{playingVideo.title}</h3>
                  <p className="text-sm text-cream/50">{playingVideo.category} • {playingVideo.duration}</p>
                </div>
                <button
                  onClick={() => setPlayingVideo(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-cream/50" />
                </button>
              </div>

              {/* Video Player */}
              <div className="aspect-video bg-void">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${playingVideo.youtubeId}?autoplay=1&rel=0`}
                  title={playingVideo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>

              {/* Video Footer */}
              <div className="p-4 border-t border-white/10">
                <p className="text-sm text-cream/70 mb-4">{playingVideo.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-cream/50">{playingVideo.views} views</span>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-profit" />
                      <span className="text-xs text-profit">Free Lesson</span>
                    </div>
                  </div>
                  <Link
                    href="/auth/signup"
                    className="px-4 py-2 bg-gold text-void text-sm font-semibold rounded-lg hover:bg-gold/90 transition-colors"
                  >
                    Start Trading Now
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
