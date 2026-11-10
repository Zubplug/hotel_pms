"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      richColors
      position="top-right"
      closeButton
      duration={4500}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast w-[min(420px,calc(100vw-2rem))] rounded-2xl border shadow-2xl",
          title: "text-sm font-bold",
          description: "text-xs leading-5 opacity-80",
          success: "border-emerald-200 bg-emerald-50 text-emerald-950",
          error: "border-rose-200 bg-rose-50 text-rose-950",
          warning: "border-amber-200 bg-amber-50 text-amber-950",
          info: "border-sky-200 bg-sky-50 text-sky-950",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
