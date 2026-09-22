import { ArrowRight, Trophy, ShieldCheck, Users } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'

const features = [
  {
    icon: Trophy,
    title: 'Funded pots',
    description: 'Create prediction pots for live matches and pool prize money into a single public challenge.',
  },
  {
    icon: Users,
    title: 'Social rankings',
    description: 'Users compete on a transparent leaderboard with score breakdowns and rank changes after each result.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure settlement',
    description: 'Automatic payout logic, refund handling, and auditable records keep the experience trustworthy.',
  },
]

export default function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-black text-primary-foreground">
              S
            </div>
            <div>
              <div className="text-xl font-black tracking-tight">SureScore</div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="text-link transition hover:text-link/80">
              Features
            </a>
            <a href="#how-it-works" className="text-link transition hover:text-link/80">
              How it works
            </a>
            <a href="#pricing" className="text-link transition hover:text-link/80">
              Pricing
            </a>
          </nav>

          <Button variant="default" className="bg-primary text-primary-foreground hover:bg-primary/80">
            Launch app
          </Button>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.2fr_0.8fr] lg:py-16">
          <div className="space-y-8">
            <Badge variant="outline" className="h-auto border-primary/40 bg-primary/10 px-3 py-1 uppercase tracking-[0.2em] text-primary">
              Social football predictions
            </Badge>

            <div className="space-y-5">
              <h1 className="max-w-xl text-5xl font-black leading-tight tracking-tight text-foreground sm:text-6xl">
                Predict the score.<br />
                Win the pot.
              </h1>
              <p className="max-w-lg text-lg text-muted-foreground">
                SureScore helps fans create and join funded football prediction pots, rank up on the leaderboard,
                and get paid automatically when the final whistle blows.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/80">
                Create a pot
              </Button>
              <Button size="lg" variant="outline" className="border-border bg-muted/50 text-foreground hover:bg-muted">
                Join a pot
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <span>90 min settlement</span>
              <span>Live rankings</span>
              <span>Instant refunds</span>
            </div>
          </div>

          <Card className="bg-card/80 shadow-2xl shadow-background/30 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4 bg-card">
              <div>
                <CardDescription className="uppercase tracking-[0.2em]">Featured pot</CardDescription>
                <CardTitle className="mt-2 text-2xl">Nigeria Derby</CardTitle>
              </div>
              <Badge>₦250,000</Badge>
            </CardHeader>
            <CardContent className="space-y-6">

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <p className="text-muted-foreground">Match</p>
                  <p className="mt-2 font-semibold">Lagos FC vs Enugu Rovers</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <p className="text-muted-foreground">Lock</p>
                  <p className="mt-2 font-semibold">15 mins before kickoff</p>
                </div>
              </div>

              <div className="rounded-2xl border border-link/30 bg-link/10 p-4">
                <div className="flex items-center justify-between text-sm text-link">
                  <span className="font-medium">Leaderboard</span>
                  <Badge variant="outline" className="border-link/40 text-link">Top 3</Badge>
                </div>
                <div className="mt-4 space-y-3 text-foreground">
                  {['1. Ada Johnson', '2. T. Okafor', '3. Victor M.'].map((player, index) => (
                    <div key={player} className="flex items-center justify-between rounded-xl bg-background/20 px-3 py-2">
                      <span className="font-medium">{player}</span>
                      <span className="text-link">{index === 0 ? '96 pts' : index === 1 ? '91 pts' : '88 pts'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="features" className="py-8">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Why SureScore</p>
            <h2 className="mt-3 text-3xl font-black text-foreground">Built for football fans who love the competition.</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="bg-card/80">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="leading-6">{description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="py-12">
          <Card className="border-primary/25 bg-card">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardDescription className="font-semibold uppercase tracking-[0.2em] text-primary">How it works</CardDescription>
                <CardTitle className="mt-2 text-3xl">Simple flow. Serious competition.</CardTitle>
              </div>
              <a href="#" className="inline-flex items-center gap-2 text-link hover:text-link/80">
                Get started <ArrowRight className="h-4 w-4" />
              </a>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              {['Create a funded pot', 'Predict before kickoff', 'Win and get paid'].map((step, index) => (
                <div key={step} className="rounded-2xl border border-border bg-background p-5">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </div>
                  <p className="text-lg font-semibold text-foreground">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
