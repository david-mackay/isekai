"use client";

export default function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span
        className="w-1 h-1 rounded-full bg-current animate-bounce"
        style={{ animationDelay: "0ms", animationDuration: "1s" }}
      />
      <span
        className="w-1 h-1 rounded-full bg-current animate-bounce"
        style={{ animationDelay: "200ms", animationDuration: "1s" }}
      />
      <span
        className="w-1 h-1 rounded-full bg-current animate-bounce"
        style={{ animationDelay: "400ms", animationDuration: "1s" }}
      />
    </span>
  );
}
