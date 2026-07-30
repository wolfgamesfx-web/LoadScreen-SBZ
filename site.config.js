// =====================================================================
//  Edit these before publishing this site to GitHub Pages.
// =====================================================================
// This tells the panel which GitHub repo it should read/write the
// loading screen's config.json and assets (images/song) to. This is
// normally the SAME repo this panel lives in (so GitHub Pages serves
// the panel, and raw.githubusercontent.com/jsDelivr serve the assets
// straight out of it), but it doesn't have to be.
window.SITE_CONFIG = {
	owner: 'your-github-username',
	repo: 'your-loadscreen-panel-repo',
	branch: 'main',

	// Path (inside the repo) to the JSON file the loading screen reads.
	configPath: 'config.json',

	// Folders (inside the repo) where uploaded assets get committed.
	imagesPath: 'assets/images',
	audioPath: 'assets/audio'
};
