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
  Check,
  type LucideIcon,
} from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { TimelineContent } from '@/components/ui/timeline-animation';

interface Feature {
  name: string;
  desc: string;
  icon: LucideIcon;
}

const features: Feature[] = [
  { name: 'Multi-slave copy', desc: 'One master account fans out to up to 10 slaves.', icon: Users },
  { name: 'Lot scaling', desc: 'Fixed lots, multiplier or balance-ratio per slave.', icon: Sliders },
  { name: 'Symbol mapping', desc: 'Map broker suffixes — EURUSD ↔ EURUSD.r.', icon: Shuffle },
  { name: 'Reverse copy', desc: 'Mirror every position as the opposite direction.', icon: ArrowLeftRight },
  { name: 'SL / TP sync', desc: 'Stops and targets mirrored, modified and closed.', icon: ShieldCheck },
  { name: 'Live latency', desc: 'Real-time copy log streamed over WebSocket.', icon: Activity },
];

const stats: { value: string; label: string }[] = [
  { value: '1 → 10', label: 'Slaves per master' },
  { value: 'MT4 · MT5', label: 'Platforms supported' },
  { value: 'Real-time', label: 'WebSocket copy log' },
  { value: 'Full', label: 'Audit trail' },
];

const revealVariants: Variants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
  hidden: { filter: 'blur(8px)', y: 16, opacity: 0 },
};

/** Illustrative rows for the copy-log preview panel. */
const copyRows: { symbol: string; side: 'BUY' | 'SELL'; lots: string; slaves: number }[] = [
  { symbol: 'EURUSD', side: 'BUY', lots: '1.00', slaves: 4 },
  { symbol: 'XAUUSD', side: 'SELL', lots: '0.50', slaves: 4 },
  { symbol: 'GBPJPY', side: 'BUY', lots: '0.75', slaves: 3 },
];

export default function LandingPage() {
  const timelineRef = useRef<HTMLDivElement>(null);

  return (
    <main ref={timelineRef} className="min-h-screen bg-white text-gray-900">
      {/* subtle top backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-gray-50 to-white" />

      {/* Nav */}
      <TimelineContent
        as="header"
        animationNum={0}
        timelineRef={timelineRef}
        customVariants={revealVariants}
        className="relative z-50 mx-auto max-w-6xl px-4 pt-5"
      >
        <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white/70 px-4 py-2.5 backdrop-blur">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Money Bank FX" className="h-8 w-8 object-contain" />
            <span className="text-[15px] font-semibold tracking-tight text-gray-900">Money Bank FX</span>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </TimelineContent>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pb-8 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <TimelineContent
            as="div"
            animationNum={1}
            timelineRef={timelineRef}
            customVariants={revealVariants}
            className="mx-auto flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            Live · Powered by MetaApi + CopyFactory
          </TimelineContent>

          <TimelineContent
            as="h1"
            animationNum={2}
            timelineRef={timelineRef}
            customVariants={revealVariants}
            className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-gray-900 sm:text-5xl xl:text-6xl"
          >
            Copy every trade, across every account,
            <br className="hidden sm:block" /> in <span className="text-brand-600">real time</span>.
          </TimelineContent>

          <TimelineContent
            as="p"
            animationNum={3}
            timelineRef={timelineRef}
            customVariants={revealVariants}
            className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg"
          >
            Master-to-slave trade copying for MT4 &amp; MT5 — lot scaling, symbol mapping,
            reverse mode and per-slave risk, with a live copy log and full audit trail.
          </TimelineContent>

          <TimelineContent
            as="div"
            animationNum={4}
            timelineRef={timelineRef}
            customVariants={revealVariants}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              Open dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Sign in
            </Link>
          </TimelineContent>

          <TimelineContent
            as="div"
            animationNum={5}
            timelineRef={timelineRef}
            customVariants={revealVariants}
            className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-gray-500"
          >
            {['MT4 & MT5', 'No installs', 'Real-time WebSocket'].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-brand-500" /> {item}
              </span>
            ))}
          </TimelineContent>
        </div>

        {/* Product preview — live copy log */}
        <TimelineContent
          as="div"
          animationNum={6}
          timelineRef={timelineRef}
          customVariants={revealVariants}
          className="mx-auto mt-16 max-w-3xl"
        >
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
                <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
                <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
                <span className="ml-2 text-sm font-medium text-gray-700">Live copy log</span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Streaming
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {copyRows.map((row) => (
                <div key={row.symbol} className="flex items-center gap-3 px-4 py-3.5">
                  <span
                    className={
                      'inline-flex h-7 items-center rounded-md px-2 text-xs font-semibold ' +
                      (row.side === 'BUY'
                        ? 'bg-brand-50 text-brand-700'
                        : 'bg-rose-50 text-rose-600')
                    }
                  >
                    {row.side}
                  </span>
                  <span className="font-medium text-gray-900">{row.symbol}</span>
                  <span className="text-sm text-gray-500">{row.lots} lots</span>
                  <span className="ml-auto flex items-center gap-1.5 text-sm text-gray-500">
                    <span className="hidden sm:inline">Copied to</span>
                    <span className="font-medium text-gray-900">{row.slaves}</span> slaves
                    <Check className="h-4 w-4 text-brand-500" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TimelineContent>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 md:grid-cols-4">
          {stats.map((stat, i) => (
            <TimelineContent
              as="div"
              animationNum={7 + i}
              timelineRef={timelineRef}
              key={stat.label}
              className="bg-white px-5 py-6 text-center"
            >
              <div className="text-xl font-semibold tracking-tight text-gray-900">{stat.value}</div>
              <div className="mt-1 text-xs text-gray-500">{stat.label}</div>
            </TimelineContent>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
            Everything you need to copy trades
          </h2>
          <p className="mt-3 text-gray-600">
            Precise control over how every position is mirrored — configured per slave, monitored in real time.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <TimelineContent
                as="div"
                animationNum={index + 8}
                timelineRef={timelineRef}
                key={feature.name}
                className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-gray-300 hover:shadow-md hover:shadow-gray-100"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-700 transition-colors group-hover:bg-brand-50 group-hover:text-brand-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-gray-900">{feature.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{feature.desc}</p>
              </TimelineContent>
            );
          })}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-gray-200 bg-gray-900 px-6 py-12 text-center">
          <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Ready to mirror your trades across every account?
          </h2>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
          >
            Open dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-gray-500 sm:flex-row"
        >
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-6 w-6 object-contain" />
            <span className="font-medium text-gray-700">Money Bank FX</span>
          </div>
          <span className="text-xs text-gray-400">MT4 / MT5 · v1.0</span>
        </motion.div>
      </footer>
    </main>
  );
}
