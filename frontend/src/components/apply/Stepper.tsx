const STEPS = ['Account', 'Personal details', 'Salary slip', 'Loan & apply'];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="grid grid-cols-4 gap-2 text-center text-xs sm:text-sm">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'active' : 'todo';
        return (
          <li key={label} className="flex flex-col items-center gap-1">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold transition ${
                state === 'done' ? 'bg-emerald-500 text-white' : state === 'active' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-500'
              }`}
            >
              {state === 'done' ? '✓' : n}
            </span>
            <span className={state === 'todo' ? 'text-slate-400' : 'text-slate-700 font-medium'}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
