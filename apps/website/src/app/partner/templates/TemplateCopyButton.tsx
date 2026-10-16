"use client";
import { useState } from "react";
export function TemplateCopyButton({ text }: { text: string }) { const [label, setLabel] = useState("Copy template"); return <button className="reach-button secondary small" onClick={async () => { await navigator.clipboard.writeText(text); setLabel("Copied"); setTimeout(() => setLabel("Copy template"), 1600); }}>{label}</button>; }
