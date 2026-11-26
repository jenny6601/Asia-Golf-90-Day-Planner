# GitHub Pages Deployment

The project is deployed as a static site through the GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

Repository configuration: Settings → Pages → Build and deployment → Source: GitHub Actions.

The deployment workflow uploads the repository root as the Pages artifact. The date-engine test workflow runs independently on pushes to `main`.

The current planner uses clearly labelled synthetic demonstration data; it is not a live weather forecast or a booking recommendation system.
