import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Briefcase, FolderOpen, Menu, Inbox } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import Image from "next/image"

export function AppHeader() {
  return (
    <header className="border-b bg-card sticky top-0 z-10">
      <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* לוגו וכותרת */}
          <div className="flex items-center gap-3 md:gap-4">
            <Link href="/" className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity">
              <Image src="/logo.png" alt="Soprodub" width={120} height={30} className="h-6 md:h-8 w-auto" priority />
            </Link>
          </div>

          {/* ניווט דסקטופ */}
          <nav className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" className="font-medium">
                שחקנים
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects">
                <Briefcase className="h-4 w-4 ml-2" />
                פרויקטים
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/folders">
                <FolderOpen className="h-4 w-4 ml-2" />
                תיקיות
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">
                <Inbox className="h-4 w-4 ml-2" />
                ניהול בקשות
              </Link>
            </Button>
          </nav>

          {/* תפריט המבורגר למובייל */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>תפריט</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 mt-6">
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/">שחקנים</Link>
                </Button>
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/projects">
                    <Briefcase className="h-4 w-4 ml-2" />
                    פרויקטים
                  </Link>
                </Button>
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/folders">
                    <FolderOpen className="h-4 w-4 ml-2" />
                    תיקיות
                  </Link>
                </Button>
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/admin">
                    <Inbox className="h-4 w-4 ml-2" />
                    ניהול בקשות
                  </Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
