<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Split/balance math lives in src/lib/split.ts with tests in split.test.ts; keep UI free of balance logic so rules stay testable.
- Google Calendar reminders use template links (src/lib/gcal.ts), not OAuth, so no per-user Google connection is needed.
- Households are created/joined only via security-definer RPCs (create_household, join_household); RLS on all tables goes through is_member().
