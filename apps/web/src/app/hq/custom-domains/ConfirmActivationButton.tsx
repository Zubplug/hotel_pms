"use client";

import { useState } from "react";

export default function ConfirmActivationButton() {
  const [open, setOpen] = useState(false);

  function submit(form: HTMLFormElement | null) {
    setOpen(false);
    form?.requestSubmit();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="relative inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white transition-all duration-200 bg-indigo-600 border border-transparent rounded-lg shadow-sm hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 active:translate-y-0">
        Configure &amp; Activate
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="domain-activation-title">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 id="domain-activation-title" className="text-lg font-semibold text-white">Confirm domain activation</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              This will configure the selected target, generate or update its verification settings, and mark the paid domain request as active.
            </p>
            <p className="mt-3 text-xs leading-5 text-amber-300">Confirm that the selected target is correct before continuing.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={(event) => submit(event.currentTarget.closest("form"))} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">Confirm &amp; activate</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
