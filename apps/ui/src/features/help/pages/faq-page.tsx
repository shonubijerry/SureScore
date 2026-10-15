import { Link } from 'react-router-dom'
import { Section } from '../../../components/bits'

const FAQ: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: 'The basics',
    items: [
      { q: 'What is SureScore?', a: 'SureScore is a social football prediction game. Someone creates a prize pot for a match, friends and fans predict the final score, and the best predictions win the prize.' },
      { q: 'What is a pot?', a: 'A pot is a prize fund tied to one football match. It has a prize amount, a number of winners (1 to 3) and a share link anyone can open to join.' },
      { q: 'Who is a potter?', a: 'The potter is the person who creates and funds a pot. Predicting on a pot does not make you a potter.' },
      { q: 'Is this betting?', a: 'No. Players never stake money. The prize is funded upfront by the potter, and you win by being the most accurate.' },
      { q: 'How do I get started?', a: 'Create a free account with your email (we email you a code to verify it), add your payout details in your profile, open a pot from Pots or Matches, and submit your predicted score.' },
    ],
  },
  {
    title: 'Predicting',
    items: [
      { q: 'Does it cost anything to predict?', a: 'No. Predicting on a pot is free. You only need payout details saved so we can send you the prize if you win.' },
      { q: 'Can a potter predict their own pot?', a: 'Yes! Potters can predict on pots they create under the same fair rules and lock times as everyone else.' },
      { q: 'Until when can I predict?', a: 'Predictions lock 15 minutes before kickoff. You can change your prediction any time before the lock.' },
      { q: 'Can I predict more than once on a pot?', a: 'Each person has one prediction per pot. Editing it replaces the previous one.' },
      { q: 'What is the optional first-goal minute?', a: 'You can guess the minute of the first goal. It is only used to break ties between players on equal points.' },
      { q: 'Where can I see how I am doing?', a: 'Open the pot to see the leaderboard. It updates as the match score changes and is final once the match ends.' },
    ],
  },
  {
    title: 'Scoring',
    items: [
      { q: 'How are points awarded?', a: 'Correct result (win, draw or loss): 3 points. Exact scoreline: 5 points. Correct goal difference: 2 points. Each team whose goals you got exactly right: 1 point. The maximum is 10 points for a perfect prediction.' },
      { q: 'Does extra time or a penalty shootout count?', a: 'No. Only the 90 minutes of regulation time, including stoppage time, counts. Extra time and penalties are ignored for scoring and payouts.' },
      { q: 'What if players have the same points?', a: 'Ties are broken first by who correctly backed the underdog, then by who guessed the first-goal minute closest. If players are still level they share the prize.' },
      { q: 'Where does the match data come from?', a: 'Fixtures and scores come from a sports data provider and are refreshed regularly (fixtures every few hours, live scores every 10 minutes). A "Score may be delayed" note appears if data is temporarily out of date.' },
    ],
  },
  {
    title: 'Prizes and payments',
    items: [
      { q: 'How is the prize split?', a: 'The platform keeps a 10% fee and 90% goes to the winners. For a three-winner pot the winner pool is split 50% / 30% / 20% by rank. A single-winner pot pays the whole winner pool to first place.' },
      { q: 'What if two players tie for a prize place?', a: 'The affected places are combined and split equally between the tied players. For example, two players tied for first share the 1st and 2nd place amounts equally.' },
      { q: 'When and how do winners get paid?', a: 'Once the match is final and the result is official, winners are paid automatically to their saved payout details. Bank processing times can add some delay.' },
      { q: 'What currency do I get paid in?', a: 'Your local currency, based on the country you chose at signup. There is no currency conversion. Nigeria (Naira, NGN) is the launch market.' },
      { q: 'My payout failed. What now?', a: 'Check that your payout details are correct and update them if needed. Our team retries failed payouts, so you do not have to do anything else.' },
      { q: 'Is my bank information safe?', a: 'Account numbers are stored encrypted, only the last four digits are ever shown, and payments are processed by our payment provider.' },
    ],
  },
  {
    title: 'Creating a pot',
    items: [
      { q: 'How do I create a pot?', a: 'Choose a match, set the prize amount and number of winners, then pay to fund the pot. It opens to predictions once funding is confirmed. Share the link with friends.' },
      { q: 'Can I make a private pot?', a: 'Yes. Choose Private when you create the pot. It is not listed in Public pots; once it is funded you get a link to copy or share, and only people with the link can view and join. Anyone who has predicted keeps access without the link.' },
      { q: 'Where do refunds go?', a: 'To the refund account you choose from your saved bank accounts when you create the pot.' },
      { q: 'Can I cancel my pot?', a: 'Yes, until 20 minutes before kickoff. A cancelled pot is refunded in full.' },
      { q: 'What happens if the match is postponed or abandoned?', a: 'The full prize is refunded to the potter. The refund is started immediately; how long it takes to arrive depends on the payment provider.' },
      { q: 'What if nobody predicts?', a: 'If no one joins, there are no winners to pay, so the pot is refunded less the 10% platform fee.' },
    ],
  },
  {
    title: 'Account and support',
    items: [
      { q: 'I forgot my password.', a: 'Tap "Forgot password?" on the sign-in page. We email a code to your account address; once it is confirmed you can set a new password, and you are signed out on other devices.' },
      { q: 'Which countries are supported?', a: 'Nigeria first. More countries will be added over time, each with its own local currency and payment options.' },
      { q: 'I need help with a payment or a result I think is wrong.', a: 'Our admin team reviews disputes and settlement exceptions. Every financial action is recorded and auditable.' },
    ],
  },
]

export default function FaqPage() {
  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight">How SureScore works</h1>
        <p className="text-sm text-muted-foreground">Quick answers for new players and potters.</p>
      </div>
      {FAQ.map(({ title, items }) => (
        <Section key={title} title={title}>
          <div className="divide-y divide-border rounded-2xl border border-border">
            {items.map(({ q, a }) => (
              <details key={q} className="group px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold marker:hidden">{q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </Section>
      ))}
      <Link to="/matches" className="block text-center text-sm font-semibold">
        Ready? Browse matches →
      </Link>
    </>
  )
}
