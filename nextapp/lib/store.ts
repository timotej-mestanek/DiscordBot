import type { GSIData } from "@/types/gsi"

export const store: {
  latest: GSIData | null
  updatedAt: number
} = {
  latest: null,
  updatedAt: 0,
}