import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function Loading() {
  return <PageSkeleton type="devices" showHeader showFilters gridCols={3} />
}
