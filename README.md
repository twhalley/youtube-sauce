# YouTube Sauce Finder

A Firefox addon that helps track and display original source videos used in YouTube content. This addon allows users to submit and view source links for videos that have used content from other creators.

## Features

- Adds a source dropdown menu to YouTube video pages
- Allows users to submit source links for videos
- Displays submitted source links with timestamps
- Clean integration with YouTube's interface
- Local storage of source data

## Installation

1. Download this repository
2. Open Firefox and go to `about:debugging`
3. Click "This Firefox" in the left sidebar
4. Click "Load Temporary Add-on"
5. Navigate to the downloaded repository and select the `manifest.json` file

## Usage

1. Navigate to any YouTube video
2. Look for the "Source Videos" dropdown button below the video
3. Click to view any submitted source links
4. To add a source:
   - Click the "+ Add Source" button
   - Enter the original video URL
   - Add a brief description
   - Click Submit

## Development

The addon is built using vanilla JavaScript and follows Firefox's WebExtensions API. The main components are:

- `manifest.json`: Addon configuration
- `content.js`: Main script that injects the source menu
- `styles.css`: Styling to match YouTube's design

## Contributing

Feel free to submit issues and pull requests to help improve the addon.

## License

MIT License 