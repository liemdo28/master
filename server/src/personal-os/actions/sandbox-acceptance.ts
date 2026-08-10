import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { google } from 'googleapis';
import { ControlledActionService } from './service';
import { getAuthedClient } from '../../visibility/connectors/google/google-auth';

function maskEmail(email: string): string {
  const [local, domain = ''] = email.split('@');
  const [name, ...domainParts] = domain.split('.');
  const suffix = domainParts.length ? `.${domainParts[domainParts.length - 1]}` : '';
  return `${local.slice(0, 2)}***@${name.slice(0, 2)}***${suffix}`;
}

function redactId(id: string | null): string | null {
  if (!id) return null;
  if (id.length <= 12) return `${id.slice(0, 3)}***`;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function localIso(daysAhead: number, hour: number, minute: number): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`;
}

function addMinutes(iso: string, minutes: number): string {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() + minutes);
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+07:00`;
}

function header(headers: Array<{ name?: string | null; value?: string | null }> | undefined, name: string): string {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

async function draftSubjectCount(subject: string): Promise<number> {
  const auth = await getAuthedClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const listed = await gmail.users.drafts.list({ userId: 'me', q: `subject:"${subject}"`, maxResults: 25 });
  const drafts = listed.data.drafts ?? [];
  let count = 0;
  for (const draft of drafts) {
    if (!draft.id) continue;
    const detail = await gmail.users.drafts.get({
      userId: 'me',
      id: draft.id,
      format: 'full',
    });
    if (header(detail.data.message?.payload?.headers, 'Subject') === subject) count += 1;
  }
  return count;
}

async function calendarEventCount(summary: string, timeMin: string, timeMax: string): Promise<number> {
  const auth = await getAuthedClient();
  const calendar = google.calendar({ version: 'v3', auth });
  const listed = await calendar.events.list({
    calendarId: 'primary',
    q: summary,
    timeMin,
    timeMax,
    singleEvents: true,
    maxResults: 25,
  });
  return (listed.data.items ?? []).filter(item => item.summary === summary).length;
}

async function findFreeSlot(): Promise<{ start: string; end: string }> {
  const auth = await getAuthedClient();
  const calendar = google.calendar({ version: 'v3', auth });
  for (let day = 21; day < 90; day += 1) {
    const start = localIso(day, 6, 5 + ((day * 7) % 45));
    const end = addMinutes(start, 20);
    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: start,
        timeMax: end,
        timeZone: 'Asia/Saigon',
        items: [{ id: 'primary' }],
      },
    });
    const busy = freeBusy.data.calendars?.primary?.busy ?? [];
    if (busy.length === 0) return { start, end };
  }
  throw new Error('No free sandbox calendar slot found.');
}

async function profileEmail(): Promise<string> {
  const auth = await getAuthedClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  return String(profile.data.emailAddress || '').toLowerCase();
}

async function main() {
  if (process.env.MI_CONTROLLED_ACTION_PROVIDER_MODE !== 'sandbox') throw new Error('MI_CONTROLLED_ACTION_PROVIDER_MODE=sandbox is required.');
  if (process.env.SAFE_GOOGLE_SANDBOX !== '1') throw new Error('SAFE_GOOGLE_SANDBOX=1 is required.');
  const sandboxAccount = String(process.env.GOOGLE_SANDBOX_ACCOUNT || '').trim().toLowerCase();
  if (!sandboxAccount) throw new Error('GOOGLE_SANDBOX_ACCOUNT is required.');
  const actualEmail = await profileEmail();
  if (actualEmail !== sandboxAccount) throw new Error('sandbox identity mismatch');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-actions-sandbox-'));
  let service = new ControlledActionService(root);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const subject = `Phase 5F sandbox draft ${stamp}`;
  const title = `Phase 5F sandbox calendar ${stamp}`;
  const { start, end } = await findFreeSlot();
  try {
    const beforeDraftCount = await draftSubjectCount(subject);
    const draft = service.proposeGmailDraft({
      to: [sandboxAccount],
      subject,
      body: 'Disposable Phase 5F sandbox draft. This message is a draft only and is not sent.',
      reason: 'Phase 5F real sandbox acceptance',
      projectId: 'mi-core',
      sensitivity: 'PRIVATE',
    });
    await service.approve(draft.id, { approver: 'sandbox-acceptance', source: 'acceptance-script' });
    const draftExecution = await service.execute(draft.id);
    const draftDuplicate = await service.execute(draft.id);
    const afterDraftCount = await draftSubjectCount(subject);

    const event = service.proposeCalendarEvent({
      title,
      start,
      end,
      timezone: 'Asia/Saigon',
      attendees: [],
      location: 'Phase 5F sandbox',
      description: 'Disposable Phase 5F sandbox calendar acceptance event.',
      projectId: 'mi-core',
      conflicts: [],
      freeBusyEvidence: 'sandbox-freebusy-rechecked-at-execution',
    }, true);
    await service.approve(event.id, { approver: 'sandbox-acceptance', source: 'acceptance-script' });
    const eventBeforeDuplicateCount = await calendarEventCount(title, start, end);
    const eventExecution = await service.execute(event.id);
    const eventDuplicate = await service.execute(event.id);
    const eventAfterDuplicateCount = await calendarEventCount(title, start, end);

    service.close();
    service = new ControlledActionService(root);
    const draftAfterRestart = service.detail(draft.id);
    const eventAfterRestart = service.detail(event.id);

    const report = {
      sandboxIdentity: maskEmail(actualEmail),
      providerMode: 'sandbox',
      gmail: {
        proposalStatus: draftAfterRestart.proposal.status,
        executionStatus: draftExecution.status,
        duplicateReturnedSameExecution: draftDuplicate.id === draftExecution.id,
        externalObjectId: redactId(draftExecution.externalObjectId),
        beforeCount: beforeDraftCount,
        afterCount: afterDraftCount,
        createdExactlyOneDraft: afterDraftCount === beforeDraftCount + 1,
        noEmailSent: draftExecution.providerResponseSummary.sent === false,
      },
      calendar: {
        proposalStatus: eventAfterRestart.proposal.status,
        executionStatus: eventExecution.status,
        duplicateReturnedSameExecution: eventDuplicate.id === eventExecution.id,
        externalObjectId: redactId(eventExecution.externalObjectId),
        beforeDuplicateCount: eventBeforeDuplicateCount,
        afterDuplicateCount: eventAfterDuplicateCount,
        createdExactlyOneEvent: eventAfterDuplicateCount === eventBeforeDuplicateCount + 1,
        sendUpdates: eventExecution.providerRequestMetadata.sendUpdates,
      },
      restartPersistence: {
        gmailExecutions: draftAfterRestart.executions.length,
        calendarExecutions: eventAfterRestart.executions.length,
      },
    };

    console.log(JSON.stringify(report, null, 2));
    if (draftExecution.status !== 'COMPLETED') throw new Error('Gmail sandbox execution did not complete.');
    if (eventExecution.status !== 'COMPLETED') throw new Error('Calendar sandbox execution did not complete.');
    if (!report.gmail.createdExactlyOneDraft) throw new Error('Gmail sandbox draft count was not exactly +1.');
    if (!report.gmail.noEmailSent) throw new Error('Gmail sandbox execution did not prove draft-only behavior.');
    if (!report.calendar.createdExactlyOneEvent) throw new Error('Calendar sandbox event count was not exactly +1.');
    if (!report.gmail.duplicateReturnedSameExecution || !report.calendar.duplicateReturnedSameExecution) throw new Error('Duplicate execute did not return original execution.');
    if (draftAfterRestart.executions.length !== 1 || eventAfterRestart.executions.length !== 1) throw new Error('Restart persistence did not preserve exactly one execution per proposal.');
  } finally {
    service.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
