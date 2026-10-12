import meridianLogo from "@/img/Meridian.png";

export function KineticBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <img src={meridianLogo} alt="" className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-5" />
      <div className="drift absolute -left-24 top-[-8%] h-[520px] w-[520px] rounded-full bg-volt/20 blur-[120px]" />
      <div className="drift absolute right-[-6%] top-[30%] h-[420px] w-[420px] rounded-full bg-volt-deep/15 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-1/3 h-[360px] w-[360px] rounded-full bg-volt/10 blur-[120px]" />
      <div className="floaty absolute right-[14%] top-[8%] h-[420px] w-[560px] rotate-[14deg] rounded-[40px] border border-line/70 bg-gradient-to-br from-frost/40 to-transparent backdrop-blur-2xl" />
      <div
        className="floaty absolute bottom-[10%] left-[6%] h-[300px] w-[420px] -rotate-[10deg] rounded-[36px] border border-volt/20 bg-gradient-to-tr from-volt/10 to-transparent backdrop-blur-2xl"
        style={{ animationDelay: "-3s" }}
      />
    </div>
  );
}
