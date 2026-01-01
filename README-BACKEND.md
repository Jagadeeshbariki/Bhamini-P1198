
# Bhamini-P1198 Backend Setup Instructions

Follow these steps to set up your separate backend project.

## 1. Local Setup
1. Create a new folder on your computer named `bhamini-backend`.
2. Place the `server.js` and `package.json` files inside it.
3. Open your terminal in that folder.
4. Run: `npm install`

## 2. MongoDB Atlas (Database)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a free account.
2. Create a new Cluster and a Database named `bhamini`.
3. Go to **Network Access** and "Allow Access from Anywhere" (0.0.0.0/0).
4. Go to **Database Access** and create a user (username/password).
5. Click **Connect** > **Drivers** and copy your **Connection String**.

## 3. Environment Variables
Create a file named `.env` in your `bhamini-backend` folder and add:
```env
PORT=5000
MONGO_URI=your_copied_mongodb_connection_string
JWT_SECRET=bhamini_secure_p1198_key_2024
```
*Note: Replace `your_copied_mongodb_connection_string` with your actual string, and make sure to put your DB password in it.*

## 4. Run the Server
In your terminal, run:
```bash
npm start
```
You should see `✅ MongoDB Connected Successfully`.

## 5. Connecting the Frontend
Ensure your frontend `config.ts` has the matching URL:
```typescript
export const API_BASE_URL = 'http://localhost:5000/api';
```

## 6. Deployment (Production)
When you are ready to go live, you can upload this folder to [Render](https://render.com) or [Vercel].
1. Connect your GitHub repo.
2. Add your `.env` variables to the Render dashboard.
3. Update the `API_BASE_URL` in your frontend to the new Render URL (e.g., `https://bhamini-api.onrender.com/api`).
