# LeetCode Leaderboard Website

A dynamic leaderboard website that fetches and ranks LeetCode user profiles based on problems solved and contest ratings.

## Features

- ✅ Enter multiple LeetCode usernames
- ✅ Fetch real-time data from LeetCode GraphQL API
- ✅ Dynamic ranking based on total problems solved
- ✅ Sort by total solved or contest rating
- ✅ Responsive design with modern UI
- ✅ Loading indicators and error handling
- ✅ Avatar display and detailed statistics

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

### 3. Open Browser
Navigate to `http://localhost:3000`

## Usage

1. Enter LeetCode usernames (one per line) in the textarea
2. Click "Generate Leaderboard" 
3. Wait for data to load
4. View ranked results with sorting options

## API Endpoint

**POST** `/leaderboard`
```json
{
  "usernames": ["user1", "user2", "user3"]
}
```

**Response:**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "username": "user1",
      "avatar": "https://...",
      "totalSolved": 150,
      "easy": 50,
      "medium": 70,
      "hard": 30,
      "contestRanking": 1500
    }
  ]
}
```

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** HTML, CSS, JavaScript
- **API:** LeetCode GraphQL
- **Styling:** Modern CSS with gradients and animations

## Error Handling

- Invalid usernames are filtered out
- API failures are handled gracefully
- User-friendly error messages displayed
- Loading states prevent multiple requests