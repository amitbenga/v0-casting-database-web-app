# Supabase Setup Guide - Authentication & RLS

**IMPORTANT:** Authentication is now ENABLED. You must complete these steps for the app to work.

---

## Step 1: Run the SQL Script

1. **Open Supabase Dashboard**
   - Go to your project: https://supabase.com/dashboard/project/[your-project-id]

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar

3. **Run the Auth Setup Script**
   - Open the file: `scripts/006_setup_auth_and_rls.sql`
   - Copy ALL the content
   - Paste it into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)

**What this does:**
- ✅ Enables Row Level Security (RLS) on all tables
- ✅ Creates `user_profiles` table
- ✅ Sets up RLS policies (who can read/write what)
- ✅ Creates automatic profile creation trigger
- ✅ Grants necessary permissions

---

## Step 2: Create Users

### Option A: Via Supabase Dashboard (Recommended)

1. **Go to Authentication → Users**
   - Click "Authentication" in the left sidebar
   - Click "Users" tab
   - Click "Add User" button

2. **Create User 1 (Leni - Admin)**
   \`\`\`
   Email: leni@madrasafree.org
   Password: [Choose a strong password]
   Auto Confirm User: ✅ Yes
   \`\`\`
   
   **User Metadata (click "Show Advanced Settings"):**
   \`\`\`json
   {
     "full_name": "Leni",
     "role": "admin"
   }
   \`\`\`

3. **Create User 2 (Sharon - Admin)**
   \`\`\`
   Email: sharon@madrasafree.org
   Password: [Choose a strong password]
   Auto Confirm User: ✅ Yes
   \`\`\`
   
   **User Metadata:**
   \`\`\`json
   {
     "full_name": "Sharon",
     "role": "admin"
   }
   \`\`\`

### Option B: Via SQL (Alternative)

If you prefer SQL, run this in SQL Editor:

\`\`\`sql
-- This requires Supabase service role key
-- Usually done via Dashboard instead
\`\`\`

---

## Step 3: Verify Setup

### Check if RLS is enabled:

\`\`\`sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
\`\`\`

Expected: All tables should have `rowsecurity = true`

### Check if policies exist:

\`\`\`sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
\`\`\`

Expected: You should see multiple policies for each table

### Check if user profiles were created:

\`\`\`sql
SELECT * FROM user_profiles;
\`\`\`

Expected: You should see 2 rows (Leni and Sharon)

---

## Step 4: Test Login

1. **Go to the app**
   - Navigate to: https://[your-app-url]/login

2. **Try logging in**
   - Use one of the emails you created
   - Enter the password

3. **Expected Result**
   - ✅ You should be redirected to the main page
   - ✅ You should see actors from Supabase
   - ✅ No authentication errors in console

---

## Troubleshooting

### Error: "relation user_profiles does not exist"

**Solution:** Run the SQL script again (Step 1)

### Error: "new row violates row-level security policy"

**Solution:** Check that RLS policies were created correctly:
\`\`\`sql
SELECT * FROM pg_policies WHERE tablename = 'actors';
\`\`\`

### Error: "Cannot coerce the result to a single JSON object"

**Solution:** This is fixed in the code. Make sure you pulled the latest changes from GitHub.

### Can't log in / Redirects to login page

**Possible causes:**
1. User doesn't exist - Create user in Supabase Dashboard
2. Wrong password - Reset password in Supabase Dashboard
3. Email not confirmed - Enable "Auto Confirm User" when creating user

---

## Security Notes

### Who Can Do What?

**Admin users (Leni, Sharon):**
- ✅ Read all actors
- ✅ Create new actors
- ✅ Update actors
- ✅ Delete actors
- ✅ Manage projects and folders

**Viewer users:**
- ✅ Read all actors
- ❌ Cannot create/update/delete

**Anonymous users (not logged in):**
- ✅ Can submit intake forms
- ❌ Cannot access the main app

### Adding More Users

To add more users:
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Set role in User Metadata: `{"role": "admin"}` or `{"role": "viewer"}`

---

## Current Status

✅ Mock data removed - No hardcoded actor data  
✅ Authentication enabled - Login required  
✅ RLS policies ready - Waiting for SQL script execution  
✅ User profiles table defined - Waiting for creation  

**Next Step:** Run the SQL script in Supabase!
