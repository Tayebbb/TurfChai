# ⚠️ Note about the training data

Heads up: you usually **shouldn't** commit ML datasets (like our CSV file) directly to a git repo. 

In a real production environment, training data lives in a bucket somewhere (like S3) and gets pulled in automatically when the pipeline runs. Committing raw data bloats the repo size, risks leaking sensitive info, and just causes headaches with merge conflicts.

### So why is it here?

Since this is our initial pet project, I intentionally left the CSV in the repository so that anyone pulling the branch can immediately test the ML pricing engine alongside the Java backend. It’s a tiny file, and I didn't want to force everyone to set up external data buckets or configure download scripts just to get the local environment running. 

We can move it out of version control once we finalize the architecture.
