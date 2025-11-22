# Exam Timetable Generator (Client-side)

This is a small, client-side single-page web app that lets a student select subjects and generate a personalised exam timetable PDF.

Highlights
- Fully client-side: no server required. Uses html2canvas + jsPDF in the browser to generate the PDF.
- Student-friendly display: shows exam date and period (Morning / Afternoon) instead of a precise clock time.
- Import / Export JSON: admins can prepare a `data.json` file and students can import it; students cannot edit subjects in-browser.
- Persistence: the app saves the subject list, the user's selected subjects, and the Extra-time toggle in localStorage.

Files
- `index.html` — main UI
- `styles.css` — small custom styles for the preview
- `app.js` — app logic, normalization, rendering and PDF export
- `data.json` — sample subject data (now using `date` + `period` entries)

Quick start (local)
1. Serve the folder and open the app in a browser (recommended so `fetch('data.json')` works):

```powershell
# from the project folder
python -m http.server 8000
# then open http://localhost:8000 in your browser
```

2. Enter the student name (optional), select one or more subjects, toggle "Extra time" if needed and click "Generate PDF".
	 - The Generate button is disabled until at least one subject is selected.

Import / Export
- Use the small upload/download buttons in the page header to import or export a subjects JSON file.
- The import expects a top-level array of subjects (see the schema below).

Data model (current)
Each subject is an object with at least a `name` and an `exams` array. The preferred exam format is date + period:

Example subject entry (preferred):

```json
{
	"name": "Biology",
	"exams": [
		{ "date": "2026-01-10", "period": "morning", "notes": "Calculator allowed", "lengthMinutes": 120 },
		{ "date": "2026-01-17", "period": "afternoon", "notes": "Resit", "lengthMinutes": 120 }
	]
}
```

Fields
- `date` — required if not using legacy `datetime`. Format: `YYYY-MM-DD`.
- `period` — either `"morning"` or `"afternoon"` (case-insensitive).
- `lengthMinutes` — integer duration in minutes (optional, default 60).
- `notes` — optional string shown beneath the exam entry.

Legacy support
- The app still accepts legacy entries that use a full ISO `datetime` (e.g. `"2026-01-10T09:00"`). When given a `datetime` the app will:
	- Infer the period (morning/afternoon) from the clock time (before 12:00 -> morning, otherwise afternoon).
	- Use a normalized internal datetime for sorting so entries order correctly across days and periods.

Display and PDF
- The preview and the generated PDF show a label like `Mon 10 Jan 2026 · Morning` followed by the duration (formatted as `1h 30m`).
- If the Extra-time toggle is enabled, durations are increased by 25% and the label shows `(incl. extra time)` inline.
- Locations are no longer used or shown.

Persistence (localStorage keys)
- `exam_timetable_data_v1` — stored subjects data
- `exam_timetable_selected_v1` — array of selected subject names
- `exam_timetable_extra_v1` — `'1'` or `'0'` for extra-time toggle

Notes and recommendations
- If you rename subjects frequently, consider adding stable `id` fields to subjects and updating the code to persist selections by id instead of name.
- You can validate or pre-process JSON on the admin side before distributing to students. The app does minimal validation and will silently try to normalize entries.
- If you want stricter validation (missing `date`/`lengthMinutes` warnings), I can add inline UI checks.

Contact / Next steps
- I can update the fallback sample in `app.js` to use `date` + `period`, add validation warnings, or update the README with a changelog — tell me which you'd like next.

