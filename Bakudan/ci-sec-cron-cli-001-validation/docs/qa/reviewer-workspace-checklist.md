# Reviewer & Approver Workspace QA Checklist

## Environment
- **Preview URL:** https://preview.dashboard.bakudanramen.com
- **Source:** E:\Project\Master\Bakudan\dashboard.bakudanramen.com

---

## STEP 1: Create Test Task
**Actor:** Creator/Admin

**Do:**
1. Go to preview dashboard
2. Navigate to Projects
3. Create new task with these fields:
   - **Title:** "QA Test - Reviewer Workspace"
   - **Review Instructions:** "Verify all compliance requirements are met. Check documentation completeness."
   - **Review Checklist:** 
     ```
     Compliance documentation complete
     Safety procedures followed
     Quality standards met
     ```
   - **Required Evidence:**
     ```
     Safety inspection photos
     Compliance certificates
     ```
   - **Required Files:**
     ```
     Safety Report PDF
     Quality Certification
     ```
   - **Reviewer:** Select a reviewer user
   - **Approver:** Select an approver user
   - **Approval Required:** ✅ Enable

**Capture:** Screenshot of task creation form with all fields filled

**Verify:** Task ID displayed after creation

---

## STEP 2: Reload & Verify Persistence
**Actor:** Creator

**Do:**
1. Navigate away from task
2. Return to task detail page
3. Refresh browser (F5)

**Capture:** Screenshot showing all review fields persisted correctly

---

## STEP 3: Assignee Opens Task
**Actor:** Assignee

**Do:**
1. Switch to assignee user
2. Open the test task
3. Navigate to Reviewer Workspace tabs

**Verify:**
- [ ] Review Instructions visible
- [ ] Review Checklist visible
- [ ] Required Evidence visible
- [ ] Required Files visible

**Capture:** Screenshot of Reviewer Workspace tabs

---

## STEP 4: Assignee Submits Task
**Actor:** Assignee

**Do:**
1. Click "Submit for Review" button
2. Confirm submission

**Verify:**
- [ ] Status changes to "Pending Review"
- [ ] Success message displayed
- [ ] Notification sent to reviewer

**Capture:** Screenshot of submission confirmation + notification evidence

---

## STEP 5: Reviewer Opens Task
**Actor:** Reviewer

**Do:**
1. Switch to reviewer user
2. Open the test task
3. Navigate to tabs:
   - Comments tab
   - Review Notes tab
   - Approval Notes tab
   - Attachments tab

**Verify:**
- [ ] Review Notes tab visible with instructions
- [ ] Checklist items visible
- [ ] Comments visible
- [ ] Attachments section visible

**Capture:** Screenshot of Reviewer Workspace with tabs

---

## STEP 6A: Reviewer Approves
**Actor:** Reviewer

**Do:**
1. Navigate to Review Notes tab
2. Add a reviewer note: "All requirements verified"
3. Navigate to Approval panel
4. Click "Approve Review"

**Verify:**
- [ ] Reviewer note saved
- [ ] Status changes to "Pending Acceptance"
- [ ] Notification sent to approver

**Capture:** Screenshot of approval confirmation

---

## STEP 6B: Reviewer Rejects (Test alternate path)
**Actor:** Reviewer

**Do:**
1. Create new test task
2. Submit for review
3. Navigate to Review Notes tab
4. Click "Reject Review"
5. Provide rejection reason

**Verify:**
- [ ] Rejection reason saved
- [ ] Status changes to "Review Rejected"
- [ ] Notification sent to assignee

**Capture:** Screenshot of rejection + notification

---

## STEP 7: Approver Opens Task
**Actor:** Approver

**Do:**
1. Switch to approver user
2. Open the test task (approved by reviewer)
3. Navigate to tabs:
   - Review Notes (verify visible)
   - Approval Notes (add note)
   - Attachments

**Verify:**
- [ ] Reviewer notes visible
- [ ] Reviewer decision visible
- [ ] Attachments section visible

**Capture:** Screenshot of Approver view

---

## STEP 8: Approver Accepts
**Actor:** Approver

**Do:**
1. Navigate to Approval Notes tab
2. Add approval note: "Task approved - all standards met"
3. Click "Accept Task"

**Verify:**
- [ ] Approval note saved
- [ ] Status changes to "Done" / "Accepted"
- [ ] Final Done timestamp displayed
- [ ] Notifications sent to all parties

**Capture:** Screenshot of final acceptance

---

## STEP 9: Test @Mentions
**Actor:** Any user with task access

**Do:**
1. Open task Comments tab
2. Type comment with mentions:
   - @[Creator Name]
   - @[Assignee Name]
   - @[Reviewer Name]
3. Submit comment

**Verify:**
- [ ] @mentions highlighted in comment
- [ ] Notifications created for mentioned users
- [ ] Inbox shows mention notifications

**Capture:** Screenshot of comment with mentions + notification evidence

---

## STEP 10: Test File Attachments
**Actor:** Any user with task access

**Do:**
1. Navigate to Attachments tab
2. Upload test files:
   - PNG image
   - JPG image
   - PDF document
   - XLSX spreadsheet

**Verify:**
- [ ] All file types accepted
- [ ] File names displayed correctly
- [ ] File sizes shown
- [ ] Download links work

**Capture:** Screenshot of uploaded attachments list

---

## Database Verification

Run queries from `reviewer-workspace-test-data.sql`:

```sql
-- Verify all tables have records
SELECT 'tasks' as table_name, COUNT(*) as count FROM tasks WHERE DATE(created_at) = CURDATE();
SELECT 'task_comments' as table_name, COUNT(*) as count FROM task_comments WHERE DATE(created_at) = CURDATE();
SELECT 'task_notifications' as table_name, COUNT(*) as count FROM task_notifications WHERE DATE(created_at) = CURDATE();
SELECT 'task_reviewer_notes' as table_name, COUNT(*) as count FROM task_reviewer_notes WHERE DATE(created_at) = CURDATE();
SELECT 'task_approval_notes' as table_name, COUNT(*) as count FROM task_approval_notes WHERE DATE(created_at) = CURDATE();
SELECT 'attachments' as table_name, COUNT(*) as count FROM attachments WHERE DATE(created_at) = CURDATE();
```

---

## Error Checking

**Check for PHP errors:**
- Look at browser console (F12)
- Check error logs in /logs directory

**Check for SQL errors:**
- Review page for any database warnings
- Check MySQL error logs

---

## Sign-off

| Check | Status | Notes |
|-------|--------|-------|
| Task creates | ☐ | |
| Task saves | ☐ | |
| Task reloads | ☐ | |
| Task submits | ☐ | |
| Review works | ☐ | |
| Approval works | ☐ | |
| Notifications work | ☐ | |
| Attachments work | ☐ | |
| Comments work | ☐ | |
| @Mentions work | ☐ | |
| No PHP errors | ☐ | |
| No SQL errors | ☐ | |
| No console errors | ☐ | |

**Overall Status:** PASS / FAIL

**Tested by:** _________________  
**Date:** _________________
