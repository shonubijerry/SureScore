import { appName, services } from '@surescore/shared'
import './App.css'

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Cloudflare-ready football prediction monorepo</p>
        <h1>{appName}</h1>
        <p className="lead">
          React + Vite on the frontend, a Cloudflare Worker API, and a shared
          Prisma/D1 package wired through npm workspaces.
        </p>
      </section>

      <section className="services" aria-label="Monorepo services">
        {services.map((service) => (
          <article key={service.name} className="service-card">
            <h2>{service.name}</h2>
            <p>{service.runtime}</p>
            <span>{service.deployment}</span>
          </article>
        ))}
      </section>
    </main>
  )
}

export default App
