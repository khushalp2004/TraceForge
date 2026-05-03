# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-smoke.spec.ts >> public smoke >> contact page renders support route
- Location: e2e/public-smoke.spec.ts:25:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Tearing down "context" exceeded the test timeout of 30000ms.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - link "TraceForge logo TraceForge" [ref=e4] [cursor=pointer]:
        - /url: /
        - img "TraceForge logo" [ref=e5]
        - paragraph [ref=e7]: TraceForge
      - navigation [ref=e8]:
        - link "Product" [ref=e9] [cursor=pointer]:
          - /url: /product
        - link "Pricing" [ref=e10] [cursor=pointer]:
          - /url: /pricing
        - link "Solutions" [ref=e11] [cursor=pointer]:
          - /url: /solutions
        - link "Docs" [ref=e12] [cursor=pointer]:
          - /url: /docs
        - link "About" [ref=e13] [cursor=pointer]:
          - /url: /about
        - link "Blog" [ref=e14] [cursor=pointer]:
          - /url: /blog
      - generic [ref=e15]:
        - button "Open global search" [ref=e16] [cursor=pointer]:
          - img
          - generic [ref=e17]:
            - text: Search TraceForge
            - generic [ref=e18]: /
        - link "Login" [ref=e19] [cursor=pointer]:
          - /url: /signin
        - link "Get Started" [ref=e20] [cursor=pointer]:
          - /url: /signup
  - main [ref=e21]:
    - generic [ref=e23]:
      - paragraph [ref=e24]: Contact us
      - heading "Talk to the TraceForge team" [level=1] [ref=e25]
      - paragraph [ref=e26]: If you need help with setup, billing, onboarding, or product questions, the fastest path is email. Include your workspace or project name when relevant so we can help you faster.
      - generic [ref=e27]:
        - link "Email support team@usetraceforge.com" [ref=e28] [cursor=pointer]:
          - /url: mailto:team@usetraceforge.com
          - heading "Email support" [level=2] [ref=e29]
          - paragraph [ref=e30]: team@usetraceforge.com
        - generic [ref=e31]:
          - heading "Best for" [level=2] [ref=e32]
          - paragraph [ref=e33]: Setup help, pricing questions, integration support, onboarding, and product feedback.
  - contentinfo [ref=e34]:
    - generic [ref=e35]:
      - generic [ref=e37]:
        - generic [ref=e38]:
          - paragraph [ref=e39]: Stay in the loop
          - heading "Get TraceForge updates, launch offers, and practical release workflow tips." [level=2] [ref=e40]
          - paragraph [ref=e41]: We’ll send short product notes when new monitoring, AI, and incident workflow improvements land — plus the occasional early-access offer.
          - generic [ref=e42]:
            - generic [ref=e43]: Product updates
            - generic [ref=e44]: Launch offers
            - generic [ref=e45]: No spam
          - generic [ref=e46]:
            - link "Read quickstart" [ref=e47] [cursor=pointer]:
              - /url: /docs
            - link "Compare plans" [ref=e48] [cursor=pointer]:
              - /url: /pricing
        - generic [ref=e49]:
          - generic [ref=e50]:
            - img [ref=e52]
            - generic [ref=e55]:
              - paragraph [ref=e56]: Subscribe for email updates
              - paragraph [ref=e57]: Use your work email and we’ll keep you posted on app updates, product notes, and launch offers.
          - generic [ref=e58]:
            - generic [ref=e59]:
              - img [ref=e60]
              - generic [ref=e63]: Fresh product updates
            - generic [ref=e64]:
              - img [ref=e65]
              - generic [ref=e68]: Special offers when we launch them
          - generic [ref=e69]:
            - generic [ref=e70]:
              - generic [ref=e71]: Email address
              - textbox "Email address" [ref=e72]:
                - /placeholder: Enter your work email
              - button "Subscribe" [ref=e73] [cursor=pointer]
            - paragraph [ref=e74]: Monthly notes only. No spam. You can unsubscribe anytime.
      - generic [ref=e75]:
        - generic [ref=e76]:
          - link "TraceForge" [ref=e77] [cursor=pointer]:
            - /url: /
          - paragraph [ref=e78]: Error monitoring that groups noise, explains likely causes, routes alerts, and carries incident context into GitHub, Slack, and Jira.
          - generic [ref=e79]:
            - generic [ref=e80]: Grouped issues
            - generic [ref=e81]: Repo analysis
            - generic [ref=e82]: Slack + Jira
        - generic [ref=e83]:
          - paragraph [ref=e84]: Product
          - generic [ref=e85]:
            - link "Product" [ref=e86] [cursor=pointer]:
              - /url: /product
            - link "Solutions" [ref=e87] [cursor=pointer]:
              - /url: /solutions
            - link "Pricing" [ref=e88] [cursor=pointer]:
              - /url: /pricing
            - link "Docs" [ref=e89] [cursor=pointer]:
              - /url: /docs
        - generic [ref=e90]:
          - paragraph [ref=e91]: Company
          - generic [ref=e92]:
            - link "About" [ref=e93] [cursor=pointer]:
              - /url: /about
            - link "Blog" [ref=e94] [cursor=pointer]:
              - /url: /blog
            - link "Sign in" [ref=e95] [cursor=pointer]:
              - /url: /signin
            - link "Create account" [ref=e96] [cursor=pointer]:
              - /url: /signup
        - generic [ref=e97]:
          - paragraph [ref=e98]: Trust & support
          - generic [ref=e99]:
            - link "Terms" [ref=e100] [cursor=pointer]:
              - /url: /terms
            - link "Privacy" [ref=e101] [cursor=pointer]:
              - /url: /privacy
            - link "Security & compliance" [ref=e102] [cursor=pointer]:
              - /url: /security
            - link "Help" [ref=e103] [cursor=pointer]:
              - /url: /help
            - link "Contact us" [ref=e104] [cursor=pointer]:
              - /url: /contact
            - link "LinkedIn" [ref=e105] [cursor=pointer]:
              - /url: https://www.linkedin.com/company/traceforge
        - generic [ref=e106]:
          - paragraph [ref=e107]: Start here
          - generic [ref=e108]:
            - link "Quickstart" [ref=e109] [cursor=pointer]:
              - /url: /docs
            - link "Compare plans" [ref=e110] [cursor=pointer]:
              - /url: /pricing
            - link "See workflows" [ref=e111] [cursor=pointer]:
              - /url: /solutions
            - link "Repo analysis" [ref=e112] [cursor=pointer]:
              - /url: /blog/repo-analysis-for-faster-onboarding
      - generic [ref=e113]:
        - paragraph [ref=e114]: © 2026 TraceForge. Built for teams that want calmer production workflows.
        - generic [ref=e115]:
          - link "Documentation" [ref=e116] [cursor=pointer]:
            - /url: /docs
          - link "Privacy" [ref=e117] [cursor=pointer]:
            - /url: /privacy
          - link "Terms" [ref=e118] [cursor=pointer]:
            - /url: /terms
          - link "Plans" [ref=e119] [cursor=pointer]:
            - /url: /pricing
          - link "Start free" [ref=e120] [cursor=pointer]:
            - /url: /signup
```