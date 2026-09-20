import { ArrowRight, Trophy, ShieldCheck, Users } from 'lucide-react'
import { Button } from '../components/ui/button'

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
    <main className="min-h-screen bg-[#1b1e25] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DB0007] text-lg font-black text-white">
              S
            </div>
            <div>
              <div className="text-xl font-black tracking-tight">SureScore</div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-white/80 md:flex">
            <a href="#features" className="text-[#31d17d] transition hover:text-[#52e39d]">
              Features
            </a>
            <a href="#how-it-works" className="text-[#31d17d] transition hover:text-[#52e39d]">
              How it works
            </a>
            <a href="#pricing" className="text-[#31d17d] transition hover:text-[#52e39d]">
              Pricing
            </a>
          </nav>

          <Button variant="default" className="bg-[#DB0007] text-white hover:bg-[#f10a11]">
            Launch app
          </Button>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.2fr_0.8fr] lg:py-16">
          <div className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-[#DB0007]/40 bg-[#DB0007]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-[#ff6a70]">
              Social football predictions
            </div>

            <div className="space-y-5">
              <h1 className="max-w-xl text-5xl font-black leading-tight tracking-tight text-white sm:text-6xl">
                Predict the score.<br />
                Win the pot.
              </h1>
              <p className="max-w-lg text-lg text-white/75">
                SureScore helps fans create and join funded football prediction pots, rank up on the leaderboard,
                and get paid automatically when the final whistle blows.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Button size="lg" className="bg-[#DB0007] text-white hover:bg-[#f10a11]">
                Create a pot
              </Button>
              <Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                Join a pot
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm text-white/60">
              <span>90 min settlement</span>
              <span>Live rankings</span>
              <span>Instant refunds</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm">
            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-2xl bg-[#11151c] p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Featured pot</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Nigeria Derby</h2>
                </div>
                <div className="rounded-full bg-[#DB0007] px-3 py-1 text-xs font-semibold text-white">₦250,000</div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-2xl border border-white/10 bg-[#11151c] p-4">
                  <p className="text-white/50">Match</p>
                  <p className="mt-2 font-semibold">Lagos FC vs Enugu Rovers</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#11151c] p-4">
                  <p className="text-white/50">Lock</p>
                  <p className="mt-2 font-semibold">15 mins before kickoff</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#31d17d]/30 bg-[#31d17d]/10 p-4">
                <div className="flex items-center justify-between text-sm text-[#99f0bc]">
                  <span>Leaderboard</span>
                  <span>Top 3</span>
                </div>
                <div className="mt-4 space-y-3 text-white">
                  {['1. Ada Johnson', '2. T. Okafor', '3. Victor M.'].map((player, index) => (
                    <div key={player} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
                      <span className="font-medium">{player}</span>
                      <span className="text-[#31d17d]">{index === 0 ? '96 pts' : index === 1 ? '91 pts' : '88 pts'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-8">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ff6a70]">Why SureScore</p>
            <h2 className="mt-3 text-3xl font-black text-white">Built for football fans who love the competition.</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DB0007] text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/70">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="py-12">
          <div className="rounded-3xl border border-[#DB0007]/25 bg-[#11151c] p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ff6a70]">How it works</p>
                <h2 className="mt-2 text-3xl font-black text-white">Simple flow. Serious competition.</h2>
              </div>
              <a href="#" className="inline-flex items-center gap-2 text-[#31d17d] hover:text-[#52e39d]">
                Get started <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {['Create a funded pot', 'Predict before kickoff', 'Win and get paid'].map((step, index) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-[#1b1e25] p-5">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#DB0007] text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="text-lg font-semibold text-white">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
