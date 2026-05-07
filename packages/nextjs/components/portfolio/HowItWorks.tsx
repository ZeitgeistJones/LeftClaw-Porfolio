export const HowItWorks = () => {
  const steps = [
    {
      n: "1",
      title: "Enter any wallet address",
      body: "Or connect your own to see your builds.",
    },
    {
      n: "2",
      title: "See the full story",
      body: "Every build, audit, and consult summarized in plain English.",
    },
    {
      n: "3",
      title: "Share your portfolio",
      body: "Copy a link and show the world what you've shipped.",
    },
  ];

  return (
    <section className="max-w-4xl mx-auto px-6 py-12">
      <h2 className="text-center text-xl font-semibold mb-6 my-0">What is this?</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {steps.map(s => (
          <div
            key={s.n}
            className="bg-base-100 border border-base-300/60 rounded-xl p-5 hover:border-base-300 transition-colors"
          >
            <div className="text-primary text-sm font-mono mb-3">{s.n}</div>
            <h3 className="text-base font-semibold mb-1.5 my-0">{s.title}</h3>
            <p className="text-sm text-base-content/65 leading-relaxed my-0">{s.body}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-base-content/55 max-w-2xl mx-auto mt-10 leading-relaxed">
        LeftClaw Portfolio Explorer pulls your build history directly from the LeftClaw Services smart contract on Base.
        No account needed, no sign-up — just a wallet address. Each job gets an AI-generated summary so anyone can
        understand what was built, even if they&apos;re not technical.
      </p>
    </section>
  );
};
