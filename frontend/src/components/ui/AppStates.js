import React from 'react'

export function LoadingScreen() {
  return <main className="loading-screen" aria-live="polite"><span className="brand-mark" aria-hidden="true">N</span><p>Loading Northstar...</p></main>
}

export function EmptyState({ title, description }) {
  return <div className="empty-state" role="status"><span aria-hidden="true">▣</span><h3>{title}</h3><p>{description}</p></div>
}

export function ErrorState({ message, onRetry }) {
  return <div className="error-state" role="alert"><strong>Something went wrong</strong><p>{message}</p>{onRetry && <button onClick={onRetry}>Try again</button>}</div>
}
