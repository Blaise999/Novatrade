'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Play,
  BookOpen,
  Award,
  Clock,
  Star,
  Lock,
  ChevronRight,
  ArrowRight,
  Video,
  FileText,
  Users,
  TrendingUp,
  Target,
  Zap
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const courses = [
  {
    id: 'beginner',
    title: 'Trading Fundamentals',
    description: 'Learn the basics of trading, market analysis, and risk management',
    level: 'Beginner',
    lessons: 12,
    duration: '2 hours',
    students: 15420,
    rating: 4.8,
    thumbnail: '📊',
    color: 'from-blue-500 to-blue-600',
    free: true,
    modules: [
      'What is Trading?',
      'Understanding Markets',
      'Reading Charts 101',
      'Basic Order Types',
    ],
  },
  {
    id: 'technical',
    title: 'Technical Analysis Mastery',
    description: 'Master chart patterns, indicators, and technical trading strategies',
    level: 'Intermediate',
    lessons: 24,
    duration: '5 hours',
    students: 8930,
    rating: 4.9,
    thumbnail: '📈',
    color: 'from-profit to-emerald-600',
    free: false,
    modules: [
      'Candlestick Patterns',
      'Support & Resistance',
      'Moving Averages',
      'RSI & MACD Indicators',
    ],
  },
  {
    id: 'forex',
    title: 'Forex Trading Pro',
    description: 'Complete guide to currency trading and forex market strategies',
    level: 'Intermediate',
    lessons: 20,
    duration: '4 hours',
    students: 6240,
    rating: 4.7,
    thumbnail: '💱',
    color: 'from-gold to-yellow-600',
    free: false,
    modules: [
      'Forex Market Structure',
      'Currency Pairs Analysis',
      'Economic Indicators',
      'Trading Sessions',
    ],
  },
  {
    id: 'crypto',
    title: 'Cryptocurrency Investing',
    description: 'Navigate the crypto markets with confidence and strategy',
    level: 'All Levels',
    lessons: 18,
    duration: '3.5 hours',
    students: 12100,
    rating: 4.8,
    thumbnail: '₿',
    color: 'from-orange-500 to-orange-600',
    free: true,
    modules: [
      'Blockchain Basics',
      'Crypto Wallets & Security',
      'DeFi & Staking',
      'NFTs & Web3',
    ],
  },
  {
    id: 'risk',
    title: 'Risk Management',
    description: 'Protect your capital with professional risk management techniques',
    level: 'Advanced',
    lessons: 15,
    duration: '3 hours',
    students: 4560,
    rating: 4.9,
    thumbnail: '🛡️',
    color: 'from-loss to-red-600',
    free: false,
    modules: [
      'Position Sizing',
      'Stop Loss Strategies',
      'Portfolio Diversification',
      'Emotional Control',
    ],
  },
  {
    id: 'psychology',
    title: 'Trading Psychology',
    description: 'Master your mindset and emotions for consistent trading success',
    level: 'All Levels',
    lessons: 10,
    duration: '2 hours',
    students: 7830,
    rating: 4.6,
    thumbnail: '🧠',
    color: 'from-purple-500 to-pink-600',
    free: true,
    modules: [
      'Fear & Greed',
      'Discipline Building',
      'Handling Losses',
      'Winning Mindset',
    ],
  },
];

const webinars = [
  { title: 'Live Market Analysis', date: 'Every Monday', time: '9:00 AM EST', host: 'Alex Chen' },
  { title: 'Q&A with Pro Traders', date: 'Every Wednesday', time: '2:00 PM EST', host: 'Sarah Kim' },
  { title: 'Weekend Strategy Session', date: 'Every Saturday', time: '10:00 AM EST', host: 'Mike Ross' },
];

export default function AcademyPage() {
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  const filteredCourses = selectedLevel 
    ? courses.filter(c => c.level === selectedLevel)
    : courses;

  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-electric/10 border border-electric/20 rounded-full mb-6">
              <GraduationCap className="w-4 h-4 text-electric" />
              <span className="text-electric text-sm font-medium">Free Education</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Trading Academy
              <br />
              <span className="gradient-text-gold">Learn from the Best</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Master the markets with our comprehensive courses, live webinars, and expert guidance. 
              From beginner basics to advanced strategies.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: 'Active Students', value: '50,000+', icon: Users },
              { label: 'Video Lessons', value: '200+', icon: Video },
              { label: 'Expert Instructors', value: '15+', icon: Award },
              { label: 'Course Completion', value: '94%', icon: Target },
            ].map((stat, index) => (
              <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
                <stat.icon className="w-6 h-6 text-gold mx-auto mb-2" />
                <p className="text-2xl font-bold text-cream">{stat.value}</p>
                <p className="text-sm text-cream/50">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Level Filter */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
            <button
              onClick={() => setSelectedLevel(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedLevel === null
                  ? 'bg-gold text-void'
                  : 'bg-white/5 text-cream/70 hover:bg-white/10'
              }`}
            >
              All Courses
            </button>
            {['Beginner', 'Intermediate', 'Advanced', 'All Levels'].map((level) => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedLevel === level
                    ? 'bg-gold text-void'
                    : 'bg-white/5 text-cream/70 hover:bg-white/10'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Courses Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {filteredCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden hover:border-white/20 transition-all group"
              >
                {/* Thumbnail */}
                <div className={`relative h-40 bg-gradient-to-br ${course.color} flex items-center justify-center`}>
                  <span className="text-6xl">{course.thumbnail}</span>
                  {!course.free && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-void/50 backdrop-blur-sm rounded-full text-xs text-gold font-medium">
                      PRO
                    </div>
                  )}
                  {course.free && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-profit/80 rounded-full text-xs text-void font-medium">
                      FREE
                    </div>
                  )}
                  <div className="absolute inset-0 bg-void/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Play className="w-6 h-6 text-white ml-1" />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-cream/70">{course.level}</span>
                    <div className="flex items-center gap-1 text-gold">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-xs">{course.rating}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-cream mb-2">{course.title}</h3>
                  <p className="text-sm text-cream/60 mb-4">{course.description}</p>

                  <div className="flex items-center gap-4 text-sm text-cream/50 mb-4">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      {course.lessons} lessons
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {course.duration}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {(course.students / 1000).toFixed(1)}k
                    </div>
                  </div>

                  {/* Modules Preview */}
                  <div className="space-y-2 mb-4">
                    {course.modules.slice(0, 2).map((module, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-cream/70">
                        <ChevronRight className="w-4 h-4 text-gold" />
                        {module}
                      </div>
                    ))}
                    {course.modules.length > 2 && (
                      <span className="text-xs text-cream/50">+{course.modules.length - 2} more modules</span>
                    )}
                  </div>

                  <Link
                    href={course.free ? '/auth/signup' : '/pricing'}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-all ${
                      course.free
                        ? 'bg-profit text-void hover:bg-profit/90'
                        : 'bg-white/10 text-cream hover:bg-white/20'
                    }`}
                  >
                    {course.free ? (
                      <>
                        Start Learning
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Unlock Course
                      </>
                    )}
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Live Webinars */}
          <div className="bg-gradient-to-r from-electric/10 to-purple-500/10 rounded-2xl border border-electric/20 p-8 mb-16">
            <div className="flex items-center gap-3 mb-6">
              <Video className="w-6 h-6 text-electric" />
              <h2 className="text-2xl font-bold text-cream">Live Webinars</h2>
              <span className="px-2 py-1 bg-loss text-white text-xs rounded-full animate-pulse">LIVE</span>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {webinars.map((webinar, index) => (
                <div key={index} className="p-4 bg-void/50 rounded-xl border border-white/10">
                  <h3 className="text-cream font-medium mb-2">{webinar.title}</h3>
                  <p className="text-sm text-cream/50 mb-1">{webinar.date} at {webinar.time}</p>
                  <p className="text-xs text-electric">Hosted by {webinar.host}</p>
                  <button className="mt-3 w-full py-2 bg-electric/20 text-electric text-sm font-medium rounded-lg hover:bg-electric/30 transition-colors">
                    Set Reminder
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Learning Path */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-cream mb-8">Your Learning Path</h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              {[
                { step: 1, title: 'Fundamentals', icon: BookOpen },
                { step: 2, title: 'Technical Analysis', icon: TrendingUp },
                { step: 3, title: 'Risk Management', icon: Target },
                { step: 4, title: 'Live Trading', icon: Zap },
              ].map((item, index) => (
                <div key={item.step} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center mb-2">
                      <item.icon className="w-8 h-8 text-gold" />
                    </div>
                    <span className="text-cream font-medium">{item.title}</span>
                  </div>
                  {index < 3 && (
                    <ChevronRight className="w-6 h-6 text-cream/30 mx-4 hidden md:block" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
            >
              Start Learning Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
