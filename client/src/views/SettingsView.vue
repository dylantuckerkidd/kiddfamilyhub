<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useAuthStore } from '@/stores/auth'

const calendarStore = useCalendarStore()
const authStore = useAuthStore()

// Family sharing state
const showCreateFamily = ref(false)
const showJoinFamily = ref(false)
const familyName = ref('')
const inviteCode = ref('')
const familyError = ref('')
const familyLoading = ref(false)
const copiedCode = ref(false)
const confirmLeave = ref(false)

// iCloud state
const showAccountForm = ref(false)
const editingAccountId = ref<number | null>(null)
const accountForm = ref({ label: '', email: '', app_password: '' })
const accountTestResults = ref<Map<number, { connected: boolean; calendarName?: string; error?: string }>>(new Map())
const accountTesting = ref<Set<number>>(new Set())

onMounted(() => {
  calendarStore.fetchICloudAccounts()
})

// Family sharing methods
async function handleCreateFamily() {
  if (!familyName.value.trim()) return
  familyLoading.value = true
  familyError.value = ''
  const result = await authStore.createFamily(familyName.value.trim())
  familyLoading.value = false
  if (!result.success) {
    familyError.value = result.error || 'Failed to create family'
  } else {
    showCreateFamily.value = false
    familyName.value = ''
  }
}

async function handleJoinFamily() {
  if (!inviteCode.value.trim()) return
  familyLoading.value = true
  familyError.value = ''
  const result = await authStore.acceptInvite(inviteCode.value.trim())
  familyLoading.value = false
  if (!result.success) {
    familyError.value = result.error || 'Failed to join family'
  } else {
    showJoinFamily.value = false
    inviteCode.value = ''
  }
}

async function handleGenerateInvite() {
  familyLoading.value = true
  familyError.value = ''
  const result = await authStore.createInvite()
  familyLoading.value = false
  if (!result.success) {
    familyError.value = result.error || 'Failed to generate invite'
  }
}

async function handleLeaveFamily() {
  familyLoading.value = true
  familyError.value = ''
  const result = await authStore.leaveFamily()
  familyLoading.value = false
  confirmLeave.value = false
  if (!result.success) {
    familyError.value = result.error || 'Failed to leave family'
  }
}

function copyInviteCode(code: string) {
  navigator.clipboard.writeText(code)
  copiedCode.value = true
  setTimeout(() => { copiedCode.value = false }, 2000)
}

// iCloud methods
function openAddAccount() {
  editingAccountId.value = null
  accountForm.value = { label: '', email: '', app_password: '' }
  showAccountForm.value = true
}

function openEditAccount(account: { id: number; label: string; email: string }) {
  editingAccountId.value = account.id
  accountForm.value = { label: account.label, email: account.email, app_password: '' }
  showAccountForm.value = true
}

async function saveAccount() {
  if (!accountForm.value.label || !accountForm.value.email) return

  if (editingAccountId.value !== null) {
    const data: Record<string, string> = { label: accountForm.value.label, email: accountForm.value.email }
    if (accountForm.value.app_password) {
      data.app_password = accountForm.value.app_password
    }
    await calendarStore.updateICloudAccount(editingAccountId.value, data)
  } else {
    if (!accountForm.value.app_password) return
    await calendarStore.addICloudAccount(accountForm.value)
  }

  showAccountForm.value = false
  accountForm.value = { label: '', email: '', app_password: '' }
  editingAccountId.value = null
  await calendarStore.fetchICloudAccounts()
}

async function deleteAccount(id: number) {
  await calendarStore.deleteICloudAccount(id)
  accountTestResults.value.delete(id)
}

async function testAccount(id: number) {
  accountTesting.value.add(id)
  accountTestResults.value.delete(id)
  try {
    const result = await calendarStore.testICloudAccount(id)
    accountTestResults.value.set(id, result)
  } finally {
    accountTesting.value.delete(id)
  }
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Manage your account and connected services</p>
    </div>

    <div class="space-y-6">
      <!-- Family Sharing -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Family Sharing</h2>

        <!-- Error display -->
        <p v-if="familyError" class="text-sm text-red-600 dark:text-red-400 mb-3">{{ familyError }}</p>

        <!-- Not in a family -->
        <template v-if="!authStore.inFamily">
          <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Create or join a family to share calendars, todos, grocery lists, and more with your household.
          </p>

          <!-- Create family -->
          <div v-if="showCreateFamily" class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3 mb-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Create a Family</h3>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Family Name</label>
              <input
                v-model="familyName"
                type="text"
                class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white text-sm"
                placeholder="e.g. The Smiths"
                @keyup.enter="handleCreateFamily"
              />
            </div>
            <div class="flex gap-2">
              <button
                @click="showCreateFamily = false; familyError = ''"
                class="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleCreateFamily"
                :disabled="!familyName.trim() || familyLoading"
                class="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ familyLoading ? 'Creating...' : 'Create' }}
              </button>
            </div>
          </div>

          <!-- Join family -->
          <div v-else-if="showJoinFamily" class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3 mb-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Join a Family</h3>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Invite Code</label>
              <input
                v-model="inviteCode"
                type="text"
                class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white text-sm font-mono tracking-wider uppercase"
                placeholder="ABCD1234"
                maxlength="8"
                @keyup.enter="handleJoinFamily"
              />
            </div>
            <div class="flex gap-2">
              <button
                @click="showJoinFamily = false; familyError = ''"
                class="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleJoinFamily"
                :disabled="!inviteCode.trim() || familyLoading"
                class="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ familyLoading ? 'Joining...' : 'Join' }}
              </button>
            </div>
          </div>

          <!-- Action buttons -->
          <div v-else class="flex gap-3">
            <button
              @click="showCreateFamily = true; familyError = ''"
              class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors text-sm"
            >
              Create Family
            </button>
            <button
              @click="showJoinFamily = true; familyError = ''"
              class="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              Have an invite code?
            </button>
          </div>
        </template>

        <!-- In a family -->
        <template v-else>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Everyone in <span class="font-medium text-gray-900 dark:text-white">{{ authStore.familyInfo.family_name }}</span> shares calendars, todos, grocery lists, recipes, and maintenance logs.
          </p>

          <!-- Members list -->
          <div class="space-y-2 mb-4">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Members</h3>
            <div
              v-for="member in authStore.familyInfo.members"
              :key="member.user_id"
              class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl"
            >
              <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <span class="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {{ member.email.charAt(0).toUpperCase() }}
                </span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-gray-900 dark:text-white truncate">
                  {{ member.email }}
                  <span v-if="member.user_id === authStore.user?.id" class="text-gray-400 dark:text-gray-500">(you)</span>
                </div>
              </div>
              <span
                class="px-2 py-0.5 text-xs rounded-full font-medium"
                :class="member.role === 'owner'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'"
              >
                {{ member.role }}
              </span>
            </div>
          </div>

          <!-- Invite section -->
          <div class="mb-4">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Invite</h3>
            <div v-if="authStore.familyInfo.pending_invites?.length" class="space-y-2">
              <div
                v-for="invite in authStore.familyInfo.pending_invites"
                :key="invite.id"
                class="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl"
              >
                <code class="flex-1 text-sm font-mono tracking-wider text-gray-900 dark:text-white">{{ invite.invite_code }}</code>
                <span class="text-xs text-gray-400 dark:text-gray-500">expires {{ new Date(invite.expires_at).toLocaleDateString() }}</span>
                <button
                  @click="copyInviteCode(invite.invite_code)"
                  class="px-2.5 py-1.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  {{ copiedCode ? 'Copied!' : 'Copy' }}
                </button>
              </div>
            </div>
            <button
              @click="handleGenerateInvite"
              :disabled="familyLoading"
              class="mt-2 px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
            >
              {{ familyLoading ? 'Generating...' : 'Generate New Invite' }}
            </button>
          </div>

          <!-- Leave family -->
          <div v-if="!confirmLeave">
            <button
              @click="confirmLeave = true"
              class="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Leave Family
            </button>
          </div>
          <div v-else class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p class="text-sm text-red-700 dark:text-red-300 mb-2">
              Are you sure? Your data will become private and you'll lose access to shared items.
            </p>
            <div class="flex gap-2">
              <button
                @click="confirmLeave = false"
                class="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleLeaveFamily"
                :disabled="familyLoading"
                class="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {{ familyLoading ? 'Leaving...' : 'Leave Family' }}
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- iCloud Calendar Sync -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">iCloud Calendar Sync</h2>
          <button
            @click="openAddAccount"
            class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors text-sm"
          >
            Add Account
          </button>
        </div>
        <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Push calendar events to iCloud so the family can see them on their iPhones. You can add multiple accounts.
        </p>

        <!-- Account list -->
        <div v-if="calendarStore.icloudAccounts.length > 0" class="space-y-3 mb-4">
          <div
            v-for="account in calendarStore.icloudAccounts"
            :key="account.id"
            class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl"
          >
            <span
              class="w-3 h-3 rounded-full flex-shrink-0"
              :class="accountTestResults.get(account.id)?.connected ? 'bg-emerald-500' : 'bg-gray-400'"
            />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-900 dark:text-white text-sm truncate">{{ account.label }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ account.email }}</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                @click="testAccount(account.id)"
                :disabled="accountTesting.has(account.id)"
                class="px-2.5 py-1.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
              >
                <svg
                  v-if="accountTesting.has(account.id)"
                  class="w-4 h-4 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span v-else>Test</span>
              </button>
              <button
                @click="openEditAccount(account)"
                class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                @click="deleteAccount(account.id)"
                class="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Test results -->
          <template v-for="account in calendarStore.icloudAccounts" :key="`result-${account.id}`">
            <p
              v-if="accountTestResults.has(account.id)"
              class="text-sm font-medium pl-1"
              :class="accountTestResults.get(account.id)?.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
            >
              <template v-if="accountTestResults.get(account.id)?.connected">
                {{ account.label }}: Connected to {{ accountTestResults.get(account.id)?.calendarName }}
              </template>
              <template v-else>
                {{ account.label }}: {{ accountTestResults.get(account.id)?.error }}
              </template>
            </p>
          </template>
        </div>

        <div v-else class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          No iCloud accounts configured. Add one to start syncing events.
        </div>

        <!-- Add/Edit Account Form -->
        <div v-if="showAccountForm" class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3 mb-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ editingAccountId ? 'Edit Account' : 'Add iCloud Account' }}
          </h3>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Label</label>
            <input
              v-model="accountForm.label"
              type="text"
              class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white text-sm"
              placeholder="e.g. Mom's iCloud"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Apple ID Email</label>
            <input
              v-model="accountForm.email"
              type="email"
              class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white text-sm"
              placeholder="user@icloud.com"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              App-Specific Password
              <span v-if="editingAccountId" class="font-normal text-gray-400"> (leave blank to keep current)</span>
            </label>
            <input
              v-model="accountForm.app_password"
              type="password"
              class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white text-sm"
              placeholder="xxxx-xxxx-xxxx-xxxx"
            />
          </div>
          <div class="flex gap-2">
            <button
              @click="showAccountForm = false"
              class="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="saveAccount"
              :disabled="!accountForm.label || !accountForm.email || (!editingAccountId && !accountForm.app_password)"
              class="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ editingAccountId ? 'Save' : 'Add' }}
            </button>
          </div>
        </div>

        <div class="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl">
          <p class="text-sm text-blue-800 dark:text-blue-200">
            Each account needs an <a href="https://support.apple.com/en-us/102654" target="_blank" class="underline">app-specific password</a> generated from the Apple ID settings page. The regular Apple ID password won't work.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
