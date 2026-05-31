# cv_verifications

AI verification interview sessions and results for student candidates.

## Purpose

Stores the state and results of AI-conducted verification interviews. Each student gets one session that progresses through 4 attribute sections (language, skills, experience, soft_skills). Sessions can be paused and resumed.

## Key Columns

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | FK → auth.users. The student being verified |
| `status` | text | `in_progress` or `completed` |
| `results` | jsonb | Per-attribute evaluation results (score, verified, summary, gaps, speech_quality) |
| `overall_score` | float | Weighted average across all attributes (0.0–1.0) |
| `full_transcript` | jsonb[] | Complete Q&A history with role, text, attribute, timestamp, wasAudio flags |
| `session_state` | jsonb | Current interview position: lang, mode, current_attribute, attribute_index, question_index, attribute_history |
| `completed_at` | timestamptz | When the verification was finished |
| `created_at` | timestamptz | When the session started |

## Session State Structure

```json
{
  "lang": "sk",
  "mode": "interview",
  "current_attribute": "skills",
  "attribute_index": 1,
  "question_index": 2,
  "attribute_history": {
    "language": [
      { "question": "...", "answer": "...", "wasAudio": true }
    ]
  }
}
```

## Results Structure

```json
{
  "language": {
    "verified": true,
    "score": 0.82,
    "level": "B2 Confirmed",
    "summary": "...",
    "strengths": ["fluent expression"],
    "gaps": ["limited idioms"],
    "ai_suspected": false,
    "speech_quality": {
      "grammar": "good",
      "vocabulary": "adequate",
      "coherence": "clear",
      "filler_words": "some"
    }
  }
}
```

## Relationships

- **profiles** → `user_id` links to the student's profile
- **ai_profiles** → used during interview for CV-based questions

## Access Patterns

- Student: one session per user, resumable
- Employer: read-only access via `/api/employer/candidate/:id/verification` (requires application relationship)
- Server: full CRUD via service role key
