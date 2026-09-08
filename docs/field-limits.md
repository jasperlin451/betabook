# Field limits and feedback

Use `FieldHeader` and `FieldFeedback` from `components/ui/field-support.tsx` inside the existing HeroUI field. Storybook: **Components / Inputs / Field support**.

- Keep the semantic Label on the left and used/limit on the right, aligned with the input edges. Use the same small, muted counter for characters, tags and friends. Format large counts with commas.
- Put concise instructions below the input. Show restrictions only when invalid input needs correction. An associated error replaces the helper while the counter remains visible.
- At the limit, keep the counter neutral. For selections, keep the field visible but disabled and explain that removing an item makes room. An over-limit value shows an error and a danger-colored count.
- Selection counts announce changes politely; character counts do not announce every keystroke. Keep the field's native length validation and server validation. The display component does not enforce limits.

## Limit inventory

| Field                            | Existing limit                | Adoption                                                                          |
| -------------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| Log entry friends                | 10 selected friends           | Shared count beside Find a friend to tag; full-state helper below                 |
| Log entry notes / training notes | 2,000 characters              | Shared count beside the field label                                               |
| Edit send comment                | 2,000 characters              | Same shared count as Log entry                                                    |
| New tags                         | 8 tags; 24 characters per tag | Shared tag count; character and allowed-character errors below input              |
| Sign-up / account display name   | 100 characters                | Existing native limit; shared counter available for future adoption               |
| Contact name                     | 100 characters                | Existing native limit; shared counter available                                   |
| Contact email                    | 254 characters                | Existing native limit; no routine counter recommended                             |
| Contact message                  | 5,000 characters              | Existing native limit; shared counter available                                   |
| Journal query                    | 100 characters                | Existing native limit; no routine counter recommended                             |
| Friend lookup query              | 100 characters                | Existing truncation; show selected-friends count, not a second query-length count |
| Moderation review note           | 2,000 characters              | Server truncates; visible counter and client limit are a follow-up inconsistency  |

Search tag selection has no eight-tag cap; the eight-tag cap belongs to adding tags to a journal entry. Import file-size/row limits and numeric/date ranges are not text-field counters and retain their own controls.

Tutorials remain unchanged: this clarifies existing field limits without changing the logging workflow or lesson steps.
