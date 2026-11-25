export function OnboardingStepper({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { n: 1, label: "Bikin ID" },
    { n: 2, label: "Sambung Jam" },
    { n: 3, label: "Bikin Karakter" },
  ] as const;
  return (
    <ol className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
      {items.map((it) => {
        const done = it.n < step;
        const active = it.n === step;
        return (
          <li
            key={it.n}
            className={`rounded-md border-2 border-black px-2 py-1.5 ${
              active
                ? "bg-hg-orange text-white shadow-[2px_2px_0_#111]"
                : done
                  ? "bg-hg-yellow text-black"
                  : "bg-white text-neutral-500"
            }`}
          >
            {done ? "✓" : `${it.n}.`} {it.label}
          </li>
        );
      })}
    </ol>
  );
}
