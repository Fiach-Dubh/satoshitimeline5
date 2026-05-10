# Satoshi Nakamoto Quote Timeline

This is a dependency-free static website intended for GitHub Pages. It showcases extracted Satoshi Nakamoto writings from the attached `Kicking_the_Hornets_Nest-e3-20241005.pdf` as one interactive timeline.

## Files

- `index.html` - the page shell
- `styles.css` - Time.Graphics-inspired styling, responsive layout, and zoomable timeline visuals
- `app.js` - filtering, zoom/pan timeline map, modal quote reader, JSON export
- `data.js` - extracted timeline data
- `.nojekyll` - tells GitHub Pages to serve files directly

## Zoomable timeline

The timeline remains fully static. All zooming happens client-side in the browser with plain JavaScript and CSS. This version supports deep zoom up to **10000×**.

- Hover over the timeline map, then use **Ctrl/⌘ + scroll** to zoom around the cursor.
- The closest timeline entry becomes the focus point and is enlarged with its date/time, title, category, and source.
- Zoom now reaches **10000×**, with day/hour/minute tick marks at high detail so multiple same-day quote instances can spread across the visible timeline.
- The timeline map is intentionally tall, close to a full-screen section, so it feels like the main exhibit when visitors scroll to it.
- At deeper zoom levels, nearby and visible entries get labels so clusters can be inspected without leaving the horizontal timeline.
- The **+** and **−** buttons provide the same zoom behavior for devices where Ctrl-scroll is awkward.
- **Reset view** clears filters, search, zoom, and horizontal scroll.

## How to host on GitHub Pages

1. Create a new GitHub repository.
2. Upload all files from this folder into the repository root.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/root`, then save.
6. GitHub will publish the site at `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`.

No build step, server, database, Node, or package install is required.

## Data notes

The data was extracted programmatically from the supplied PDF and organized into source categories: Whitepaper, Email, Cryptography Mailing List, SourceForge / Bitcoin list, P2P Foundation, bitcoin.org/smf Forums, and Other. Because this is a PDF extraction, the full text should be treated as a faithful convenience layer rather than a legal or scholarly critical edition. Verify sensitive citations against the original sources.


## Project edit notes

- The graphical timeline now supports deep zoom up to **10000×**.
- Visible references to the forum source are labeled **bitcoin.org/smf Forums**.
- Martti Malmi reply/interaction entries are grouped under the **Email** category.


## Latest update

- Removed the bottom bar chart from the zoomable timeline exhibit.
- Kept the project fully static and GitHub Pages compatible.
