import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#0a0a0a] px-6 text-white">
      <div className="max-w-xl">
        <ShieldCheck className="size-8 text-stone-500" />
        <p className="eyebrow mt-8">Privacy by design</p>
        <h1 className="mt-5 font-serif text-6xl tracking-tight">Your work stays yours.</h1>
        <p className="mt-7 text-sm leading-7 text-stone-400">
          LAST LOOK processes images locally in your browser. Images are not uploaded to a server, no account is required,
          and exported files have metadata removed where the browser permits.
        </p>
        <Link href="/" className="mt-10 flex items-center gap-2 text-xs text-stone-400 hover:text-white">
          <ArrowLeft className="size-3.5" /> Back home
        </Link>
      </div>
    </main>
  );
}
