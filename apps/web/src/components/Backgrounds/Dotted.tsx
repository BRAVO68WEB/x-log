import { GridPattern } from "@/components/ui/grid-pattern";

export function Dotted() {
  return (
    <>
      <div className="fixed inset-0 -z-[1] bg-background" />
      <GridPattern
        width={48}
        height={48}
        className="fixed inset-0 -z-[1] [mask-image:radial-gradient(600px_circle_at_center,white,transparent)]"
      />
      <div className="mask-t pointer-events-none fixed hidden md:block inset-x-0 top-0 z-40 h-[88px] w-full select-none backdrop-blur-[1px]" />
    </>
  );
}
