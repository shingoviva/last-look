import Link from "next/link";
import { ArrowRight, Check, Crop, ScanEye, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link href="/" className="text-sm font-semibold tracking-[.32em]">LAST LOOK</Link>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hidden text-xs text-stone-500 transition hover:text-white sm:block">Privacy</Link>
          <Link href="/app">
            <Button size="sm">Open Workspace <ArrowRight className="size-3.5" /></Button>
          </Link>
        </div>
      </nav>

      <section className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-[.86fr_1.14fr] lg:px-10 lg:py-16">
        <div className="relative z-10">
          <p className="eyebrow">Instagram pre-flight check</p>
          <h1 className="mt-7 max-w-2xl font-serif text-[clamp(4rem,10vw,8rem)] leading-[.78] tracking-[-.055em]">
            One last<br /><span className="text-stone-500">look.</span>
          </h1>
          <p className="mt-8 max-w-md text-base leading-7 text-stone-400">
            See the crop. Protect the color. Export with confidence. The final check before you post.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/app">
              <Button className="h-13 px-7">Open Workspace <ArrowRight className="size-4" /></Button>
            </Link>
            <span className="flex items-center gap-2 text-[11px] text-stone-500">
              <ShieldCheck className="size-4" /> No signup. Local browser processing.
            </span>
          </div>
          <div className="mt-16 grid max-w-lg grid-cols-3 gap-3">
            {[
              [ScanEye, "01", "Preview the post"],
              [Crop, "02", "Perfect the frame"],
              [Sparkles, "03", "Export it safely"],
            ].map(([Icon, number, label]) => {
              const FeatureIcon = Icon as typeof ScanEye;
              return (
                <div key={String(number)} className="border-t border-white/12 pt-4">
                  <FeatureIcon className="mb-5 size-4 text-stone-500" />
                  <span className="block text-[9px] text-stone-600">{String(number)}</span>
                  <span className="mt-1 block text-[11px]">{String(label)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative flex min-h-[600px] items-center justify-center lg:min-h-[720px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,152,206,.13),transparent_58%)]" />
          <div className="absolute left-[5%] top-[16%] hidden w-44 rounded-3xl border border-white/10 bg-white/[.045] p-4 shadow-2xl backdrop-blur-xl md:block">
            <p className="eyebrow">Current ratio</p>
            <p className="mt-6 font-serif text-4xl">3:4</p>
            <p className="mt-2 text-[9px] text-stone-500">Current Instagram</p>
          </div>
          <div className="relative z-10 w-[min(78vw,330px)] rotate-[2deg] rounded-[3.2rem] border border-white/15 bg-[#050505] p-2.5 shadow-[0_60px_140px_rgba(0,0,0,.8)]">
            <div className="absolute left-1/2 top-4 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
            <div className="overflow-hidden rounded-[2.55rem] bg-[#151515]">
              <div className="flex h-16 items-end justify-between px-5 pb-3 text-[9px]">
                <span>9:41</span><span className="tracking-[.25em]">PREVIEW</span><span>● ◒</span>
              </div>
              <div className="flex h-12 items-center gap-3 px-4">
                <span className="size-7 rounded-full bg-stone-700" />
                <span className="text-[10px]">your.archive</span>
              </div>
              <div className="relative aspect-[3/4] overflow-hidden bg-[#b9b3aa]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_54%_27%,#e9d6c8_0_10%,transparent_11%),linear-gradient(155deg,transparent_0_28%,#303337_29_58%,#9b9185_59%)]" />
                <div className="absolute bottom-7 left-6 text-[9px] uppercase tracking-[.28em] text-white/80">Soft Classic</div>
              </div>
              <div className="p-4">
                <div className="mb-5 flex gap-4 text-sm">♡　○　↗ <span className="ml-auto">◇</span></div>
                <div className="h-1.5 w-28 rounded bg-white/20" />
                <div className="mt-2 h-1.5 w-40 rounded bg-white/10" />
              </div>
            </div>
          </div>
          <div className="absolute bottom-[10%] right-[0%] z-20 hidden w-52 rounded-3xl border border-white/10 bg-[#131313]/90 p-4 shadow-2xl backdrop-blur-xl md:block">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-white text-black"><Check className="size-4" /></span>
              <div><p className="text-[11px]">Instagram Safe</p><p className="text-[9px] text-stone-500">1080 × 1440 JPEG</p></div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
