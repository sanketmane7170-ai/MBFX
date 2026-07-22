import { useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Sliders,
  Shuffle,
  ArrowLeftRight,
  ShieldCheck,
  Activity,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import { TimelineContent } from '@/components/ui/timeline-animation';

interface Feature {
  name: string;
  desc: string;
  icon: LucideIcon;
  gradient: string;
}

const features: Feature[] = [
  { name: 'Multi-Slave Copy', desc: 'One master → up to 10 slaves', icon: Users, gradient: 'from-blue-500 to-indigo-600' },
  { name: 'Lot Scaling', desc: 'Fixed · multiplier · balance ratio', icon: Sliders, gradient: 'from-emerald-500 to-teal-600' },
  { name: 'Symbol Mapping', desc: 'EURUSD ↔ EURUSD.r', icon: Shuffle, gradient: 'from-violet-500 to-purple-600' },
  { name: 'Reverse Copy', desc: 'Mirror as opposite direction', icon: ArrowLeftRight, gradient: 'from-orange-500 to-red-500' },
  { name: 'SL / TP Sync', desc: 'Stops & targets mirrored + closed', icon: ShieldCheck, gradient: 'from-cyan-500 to-blue-600' },
  { name: 'Live Latency', desc: 'Real-time copy log over WebSocket', icon: Activity, gradient: 'from-fuchsia-500 to-pink-600' },
];

const revealVariants: Variants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { delay: i * 0.12, duration: 0.5 },
  }),
  hidden: { filter: 'blur(10px)', y: -20, opacity: 0 },
};

export default function LandingPage() {
  const timelineRef = useRef<HTMLDivElement>(null);

  return (
    <main ref={timelineRef} className="bg-white min-h-screen">
      {/* Nav */}
      <TimelineContent
        as="header"
        animationNum={0}
        timelineRef={timelineRef}
        customVariants={revealVariants}
        className="w-full top-1.5 left-0 z-50 relative md:px-0 px-2 pt-3"
      >
        <div className="2xl:max-w-6xl max-w-5xl p-2 h-full relative mx-auto flex justify-between items-center rounded-lg backdrop-blur-2xl bg-zinc-100/40 border border-zinc-200/60">
          <Link to="/" className="flex items-center gap-2 px-2">
            <img src="/logo.png" alt="MoneyBank FX" className="h-9 w-9 object-contain" />
            <span className="text-lg font-bold text-gray-900">MoneyBank FX</span>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-indigo-700 transition-colors"
          >
            Sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </TimelineContent>

      <div className="pt-20 pb-10 max-w-screen-2xl mx-auto px-4">
        <article className="w-fit mx-auto 2xl:max-w-5xl xl:max-w-4xl max-w-2xl text-center space-y-6">
          <TimelineContent
            as="div"
            animationNum={1}
            timelineRef={timelineRef}
            customVariants={revealVariants}
            className="flex w-fit mx-auto items-center gap-1 rounded-full bg-blue-600 border-4 border-blue-200 py-0.5 pl-0.5 pr-3 text-xs"
          >
            <div className="rounded-full bg-white px-2 py-1 text-xs text-black font-medium">Live</div>
            <p className="text-white sm:text-base text-xs inline-block px-1">
              ⚡ Powered by <span className="font-semibold">MetaApi + CopyFactory</span>
            </p>
          </TimelineContent>

          <TimelineContent
            as="h1"
            animationNum={2}
            timelineRef={timelineRef}
            customVariants={revealVariants}
            className="2xl:text-7xl text-gray-900 xl:text-6xl sm:text-5xl text-4xl leading-[100%] font-medium"
          >
            Copy Every Trade,{' '}
            <span className="font-semibold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              Across Every Account
            </span>
            , In{' '}
            <span className="font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
              Real Time
            </span>
            .
          </TimelineContent>

          <TimelineContent
            as="p"
            animationNum={3}
            timelineRef={timelineRef}
            customVariants={revealVariants}
            className="lg:text-xl text-gray-600 sm:text-lg text-sm max-w-2xl mx-auto"
          >
            Master-to-slave trade copying for MT4 / MT5 — lot scaling, symbol mapping,
            reverse mode and per-slave risk, with a live copy log and full audit trail.
          </TimelineContent>

          <TimelineContent
            as="div"
            animationNum={4}
            timelineRef={timelineRef}
            customVariants={revealVariants}
            className="flex items-center justify-center gap-3 pt-2"
          >
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-3 text-sm font-medium text-white hover:from-blue-600 hover:to-indigo-700 transition-colors shadow-lg shadow-blue-200"
            >
              Open Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </TimelineContent>
        </article>

        {/* Feature cards */}
        <div className="grid md:grid-cols-3 grid-cols-2 gap-6 pt-20 max-w-5xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <TimelineContent
                as="div"
                animationNum={index + 5}
                timelineRef={timelineRef}
                key={feature.name}
                className="relative aspect-video rounded-xl overflow-hidden shadow-sm"
              >
                <div className={cn('h-full w-full bg-gradient-to-br', feature.gradient)}>
                  <div className="absolute top-4 left-4 h-10 w-10 rounded-lg bg-white/20 backdrop-blur grid place-content-center">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <ProgressiveBlur
                  className="pointer-events-none absolute bottom-0 left-0 h-[40%] w-full"
                  blurIntensity={0.5}
                />
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="2xl:text-xl md:text-lg text-sm font-semibold text-white capitalize">
                    {feature.name}
                  </h3>
                  <p className="text-xs text-white/80">{feature.desc}</p>
                </div>
              </TimelineContent>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-center text-xs text-gray-400 pt-16"
        >
          MoneyBank FX · MT4 / MT5 · v1.0
        </motion.p>
      </div>
    </main>
  );
}
