import { Link } from "react-router-dom"
import { Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common"

export default function NotFoundPage() {
  return (
    <EmptyState icon={Compass} title="Page not found">
      <Button asChild className="mt-3"><Link to="/">Back to home</Link></Button>
    </EmptyState>
  )
}
