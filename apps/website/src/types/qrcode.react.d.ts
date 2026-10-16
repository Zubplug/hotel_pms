declare module "qrcode.react" {
  import type { ComponentType } from "react";
  export const QRCodeSVG: ComponentType<{ value: string; size?: number; includeMargin?: boolean }>;
}
