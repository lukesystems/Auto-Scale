# SECURITY.md - AutoScale Secret Management & Rotation

If a secret key (such as `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) has been accidentally committed to the repository, you **MUST** rotate the keys immediately. Below are the exact steps.

## Step 1: Rotate Keys in Supabase

1. Open your **Supabase Dashboard**.
2. Go to **Project Settings** (gear icon) -> **API**.
3. Under **JWT Settings**, click **Generate new JWT Secret**.
   - *Warning: This immediately invalidates all existing JWT tokens, active user sessions, and API keys.*
4. Copy the new **anon** public key and update your local `.env.local` file.
5. Copy the new **service_role** secret key and update your local `.env.local` file.
6. Verify that your application can still connect to Supabase locally using the new keys.

## Step 2: Purge Git History

Even if you delete the keys in a new commit, they remain in the git history and can be accessed. You must purge the history:

### Using BFG Repo-Cleaner (Recommended)
1. Install BFG (e.g. `brew install bfg` or download the JAR).
2. Create a file named `secrets.txt` and place the leaked key in it (exactly as it appeared).
3. Run:
   ```bash
   bfg --replace-text secrets.txt
   ```
4. Run garbage collection to clean up references:
   ```bash
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   ```

### Using Git Filter-Repo
Alternatively, use `git-filter-repo` (Python required):
1. Install `git-filter-repo` (`pip install git-filter-repo`).
2. Run:
   ```bash
   git filter-repo --invert-paths --path .env.local
   ```
3. Or to scrub text:
   ```bash
   git filter-repo --message-callback '
     return message.replace(b"YOUR_LEAKED_KEY_HERE", b"")
   '
   ```

## Step 3: Force Push
After purging the history, force-push the branch to update GitHub:
```bash
git push origin main --force
```

> [!CAUTION]
> Force pushing will overwrite remote history. Ensure other developers on the team are aware so they can re-clone the repository.
