import { supabase } from "./supabase";
import { generateStudentToken, verifyStudentToken } from "./hmac-tokens";
import type {
  Tutor,
  InsertTutor,
  Student,
  InsertStudent,
  Lesson,
  InsertLesson,
  Payment,
  InsertPayment,
  Task,
  InsertTask,
  Homework,
  InsertHomework,
  SubscriptionPrice,
  InsertSubscriptionPrice,
  SubscriptionPayment,
  InsertSubscriptionPayment,
  Notification,
  InsertNotification,
  LessonTemplate,
  InsertLessonTemplate,
  PasswordResetToken,
  StudentAccessToken,
  InsertStudentAccessToken,
  AiChatMessage,
  InsertAiChatMessage,
  AiChat,
  InsertAiChat,
  Conference,
  InsertConference,
  TutorAiChat,
  InsertTutorAiChat,
  TutorAiChatMessage,
  InsertTutorAiChatMessage,
  FeatureFlag,
  InsertFeatureFlag,
  SupportTicket,
  InsertSupportTicket,
  SupportMessage,
  InsertSupportMessage,
  SavedLessonPlan,
  InsertSavedLessonPlan,
  StudentApplication,
  InsertStudentApplication,
  Quiz,
  InsertQuiz,
  QuizAttempt,
  InsertQuizAttempt,
  LessonRecording,
  InsertLessonRecording,
} from "@shared/schema";

const TABLE_PREFIX = "Tvoy_vector_2_";

export interface IStorage {
  getTutor(id: string): Promise<Tutor | undefined>;
  getTutorByEmail(email: string): Promise<Tutor | undefined>;
  getTutorBySlug(slug: string): Promise<Tutor | undefined>;
  getTutorByBotToken(token: string): Promise<Tutor | undefined>;
  setBotToken(tutorId: string, token: string): Promise<void>;
  createTutor(tutor: InsertTutor): Promise<Tutor>;
  updateTutor(id: string, updates: Partial<InsertTutor>): Promise<Tutor | undefined>;
  deleteTutor(id: string): Promise<void>;
  getAllTutors(): Promise<Tutor[]>;
  getStudentsByTutorId(tutorId: string): Promise<Student[]>;
  getStudent(id: string): Promise<Student | undefined>;
  getStudentByEmail(email: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: string, updates: Partial<InsertStudent>): Promise<Student | undefined>;
  deleteStudent(id: string): Promise<void>;
  getStudentByTelegramChatId(chatId: string): Promise<Student | undefined>;
  getTutorByTelegramChatId(chatId: string): Promise<Tutor | undefined>;
  getLessonsByTutorId(tutorId: string, limit?: number): Promise<Lesson[]>;
  getLesson(id: string): Promise<Lesson | undefined>;
  createLesson(lesson: InsertLesson): Promise<Lesson>;
  updateLesson(id: string, updates: Partial<InsertLesson>): Promise<Lesson | undefined>;
  deleteLesson(id: string): Promise<void>;
  getPaymentsByTutorId(tutorId: string, limit?: number): Promise<Payment[]>;
  getPaymentsByStudentId(studentId: string, limit?: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: string): Promise<Payment | undefined>;
  updatePayment(id: string, updates: Partial<InsertPayment & { yookassaStatus: string }>): Promise<Payment | undefined>;
  deletePayment(id: string): Promise<void>;
  getTasksByTutorId(tutorId: string, limit?: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  deleteTasks(ids: string[]): Promise<void>;
  getHomeworkByTutorId(tutorId: string, limit?: number): Promise<Homework[]>;
  getHomeworkByStudentId(studentId: string, limit?: number): Promise<Homework[]>;
  getHomework(id: string): Promise<Homework | undefined>;
  createHomework(hw: InsertHomework): Promise<Homework>;
  updateHomework(id: string, updates: Partial<InsertHomework>): Promise<Homework | undefined>;
  getSubscriptionPrices(): Promise<SubscriptionPrice[]>;
  updateSubscriptionPrice(tier: string, updates: Partial<InsertSubscriptionPrice>): Promise<SubscriptionPrice | undefined>;
  getSubscriptionPaymentsByTutorId(tutorId: string): Promise<SubscriptionPayment[]>;
  getAllPayments(limit?: number): Promise<Payment[]>;
  getAllSubscriptionPayments(limit?: number): Promise<SubscriptionPayment[]>;
  createSubscriptionPayment(payment: InsertSubscriptionPayment): Promise<SubscriptionPayment>;
  updateSubscriptionPayment(id: string, updates: Partial<InsertSubscriptionPayment>): Promise<SubscriptionPayment | undefined>;
  getSubscriptionPaymentByYookassaId(yookassaId: string): Promise<SubscriptionPayment | undefined>;
  getNotificationsByTutorId(tutorId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotificationsCount(tutorId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(tutorId: string): Promise<void>;
  createStudentApplication(app: InsertStudentApplication): Promise<StudentApplication>;
  getStudentApplicationsByTutor(tutorId: string, status?: string): Promise<StudentApplication[]>;
  getStudentApplication(id: string): Promise<StudentApplication | undefined>;
  updateStudentApplicationStatus(id: string, status: string, studentId?: string): Promise<StudentApplication | undefined>;
  getPendingApplicationsCountByTutor(tutorId: string): Promise<number>;
  // Quiz / тренажёры
  getQuizzesByTutor(tutorId: string): Promise<Quiz[]>;
  getQuizzesAvailableToStudent(studentId: string): Promise<Quiz[]>;
  getQuiz(id: string): Promise<Quiz | undefined>;
  createQuiz(q: InsertQuiz): Promise<Quiz>;
  updateQuiz(id: string, updates: Partial<InsertQuiz>): Promise<Quiz | undefined>;
  deleteQuiz(id: string): Promise<void>;
  createQuizAttempt(a: InsertQuizAttempt): Promise<QuizAttempt>;
  getQuizAttemptsByQuiz(quizId: string): Promise<QuizAttempt[]>;
  getQuizAttemptsByStudent(studentId: string, limit?: number): Promise<QuizAttempt[]>;
  getQuizAttemptsByTutor(tutorId: string, limit?: number): Promise<QuizAttempt[]>;
  // Lesson Recordings
  createLessonRecording(r: InsertLessonRecording): Promise<LessonRecording>;
  getLessonRecording(id: string): Promise<LessonRecording | undefined>;
  getLessonRecordingsByTutor(tutorId: string, limit?: number): Promise<LessonRecording[]>;
  getLessonRecordingsByStudent(studentId: string, limit?: number): Promise<LessonRecording[]>;
  getLessonRecordingByBbbRecordId(bbbRecordId: string): Promise<LessonRecording | undefined>;
  updateLessonRecording(id: string, updates: Partial<InsertLessonRecording>): Promise<LessonRecording | undefined>;
  deleteLessonRecording(id: string): Promise<void>;
  getLessonTemplatesByTutorId(tutorId: string): Promise<LessonTemplate[]>;
  getPublicLessonTemplates(): Promise<LessonTemplate[]>;
  getLessonTemplate(id: string): Promise<LessonTemplate | undefined>;
  createLessonTemplate(template: InsertLessonTemplate): Promise<LessonTemplate>;
  updateLessonTemplate(id: string, updates: Partial<InsertLessonTemplate>): Promise<LessonTemplate | undefined>;
  deleteLessonTemplate(id: string): Promise<void>;
  getSavedLessonPlans(tutorId: string): Promise<SavedLessonPlan[]>;
  createSavedLessonPlan(plan: InsertSavedLessonPlan): Promise<SavedLessonPlan>;
  deleteSavedLessonPlan(id: string, tutorId: string): Promise<void>;
  createPasswordResetToken(tutorId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<void>;
  // V3.6: email verification + referrals + 2FA
  createEmailVerificationToken(tutorId: string, token: string, expiresAt: Date): Promise<void>;
  getEmailVerificationToken(token: string): Promise<{ id: string; tutorId: string; expiresAt: string; usedAt: string | null } | undefined>;
  markEmailVerificationTokenUsed(id: string): Promise<void>;

  // Student email verification
  createStudentEmailVerificationToken(studentId: string, token: string, expiresAt: Date): Promise<void>;
  getStudentEmailVerificationToken(token: string): Promise<{ id: string; studentId: string; expiresAt: string; usedAt: string | null } | undefined>;
  markStudentEmailVerificationTokenUsed(id: string): Promise<void>;

  // Student password reset
  createStudentPasswordResetToken(studentId: string, token: string, expiresAt: Date): Promise<void>;
  getStudentPasswordResetToken(token: string): Promise<{ id: string; studentId: string; expiresAt: string; usedAt: string | null } | undefined>;
  markStudentPasswordResetTokenUsed(id: string): Promise<void>;
  getTutorByReferralCode(code: string): Promise<Tutor | undefined>;
  getReferredTutors(tutorId: string): Promise<Tutor[]>;
  createTwoFactorCode(tutorId: string, code: string, expiresAt: Date): Promise<void>;
  verifyTwoFactorCode(tutorId: string, code: string): Promise<boolean>;
  // Student portal methods
  createStudentAccessToken(studentId: string, token?: string): Promise<StudentAccessToken>;
  getStudentAccessToken(token: string): Promise<StudentAccessToken | undefined>;
  getStudentAccessTokensByStudentId(studentId: string): Promise<StudentAccessToken[]>;
  updateStudentAccessTokenLastUsed(id: string): Promise<void>;
  deactivateStudentAccessToken(id: string): Promise<void>;
  // AI chat methods
  getAiChatsByStudentId(studentId: string): Promise<AiChat[]>;
  getAiChat(chatId: string): Promise<AiChat | undefined>;
  createAiChat(chat: InsertAiChat): Promise<AiChat>;
  updateAiChatTitle(chatId: string, title: string): Promise<void>;
  deleteAiChat(chatId: string): Promise<void>;
  getAiChatMessagesByChatId(chatId: string, limit?: number): Promise<AiChatMessage[]>;
  getAiChatMessagesByStudentId(studentId: string, limit?: number): Promise<AiChatMessage[]>;
  getAiChatMessagesByHomeworkId(homeworkId: string, limit?: number): Promise<AiChatMessage[]>;
  createAiChatMessage(message: InsertAiChatMessage): Promise<AiChatMessage>;
  // Student lessons
  getLessonsByStudentId(studentId: string, limit?: number): Promise<Lesson[]>;
  // AI settings
  getAiSettings(): Promise<Record<string, string>>;
  getAiSetting(key: string): Promise<string | undefined>;
  setAiSetting(key: string, value: string): Promise<void>;
  // AI usage tracking
  getAiUsageToday(studentId: string, model: string): Promise<number>;
  incrementAiUsage(studentId: string, model: string): Promise<void>;
  // Tutor AI chat methods
  getTutorAiChatsByTutorId(tutorId: string): Promise<TutorAiChat[]>;
  getTutorAiChat(chatId: string): Promise<TutorAiChat | undefined>;
  createTutorAiChat(chat: InsertTutorAiChat): Promise<TutorAiChat>;
  updateTutorAiChatTitle(chatId: string, title: string): Promise<void>;
  deleteTutorAiChat(chatId: string): Promise<void>;
  getTutorAiChatMessagesByChatId(chatId: string, limit?: number): Promise<TutorAiChatMessage[]>;
  createTutorAiChatMessage(message: InsertTutorAiChatMessage): Promise<TutorAiChatMessage>;
  getTutorAiUsageToday(tutorId: string, model: string): Promise<number>;
  incrementTutorAiUsage(tutorId: string, model: string): Promise<void>;
  getAiPackageBalance(ownerId: string, ownerType: 'tutor' | 'student'): Promise<number>;
  getAiPackages(ownerId: string, ownerType: 'tutor' | 'student'): Promise<any[]>;
  purchaseAiPackage(ownerId: string, ownerType: 'tutor' | 'student', credits: number, pricePaid: number): Promise<any>;
  consumeAiPackageCredit(ownerId: string, ownerType: 'tutor' | 'student'): Promise<boolean>;
  // BBB Conference methods
  getConferencesByTutorId(tutorId: string): Promise<Conference[]>;
  getConference(id: string): Promise<Conference | undefined>;
  getConferenceByStudentId(studentId: string): Promise<Conference | undefined>;
  createConference(conf: InsertConference): Promise<Conference>;
  updateConference(id: string, data: Partial<InsertConference>): Promise<Conference>;
  deleteConference(id: string): Promise<void>;
  // Task bank methods
  getTaskBankMeta(): Promise<{ subjects: string[]; classes: string[]; topics: string[]; difficulties: string[] }>;
  getTaskBank(filters: { subject?: string; class?: string; topic?: string; difficulty?: string; search?: string }, page: number, limit: number): Promise<{ tasks: any[]; total: number }>;
  getTaskById(id: string): Promise<any | undefined>;
  getRandomTask(filters: { subject?: string; class?: string; topic?: string; difficulty?: string }): Promise<any | null>;
  getRandomTasksForGroups(groups: Array<{ topic: string; class?: string; difficulty?: string; count: number }>, excludeIds?: string[]): Promise<any[]>;
  getTasksByIds(ids: string[]): Promise<any[]>;
  getVariantsByTutor(tutorId: string): Promise<any[]>;
  getVariantById(id: string): Promise<any | undefined>;
  createVariant(tutorId: string, name: string, taskIds: string[]): Promise<any>;
  updateVariant(id: string, updates: { name?: string; taskIds?: string[] }): Promise<any>;
  deleteVariant(id: string): Promise<void>;
  assignVariant(variantId: string, studentIds: string[], tutorId: string): Promise<void>;
  getStudentVariants(studentId: string): Promise<any[]>;
  getStudentVariantById(variantId: string, studentId: string): Promise<any | undefined>;
  // Backup methods
  getBackupsByTutorId(tutorId: string): Promise<any[]>;
  getBackupById(id: string): Promise<any | undefined>;
  createBackup(tutorId: string, type: string, note: string | null, dataJson: string): Promise<any>;
  deleteBackup(id: string): Promise<void>;
  deleteOldAutoBackups(tutorId: string, keepCount: number): Promise<void>;
  // Reviews
  createReview(input: { tutorId: string; authorName: string; authorContact: string | null; rating: number; text: string }): Promise<any>;
  getApprovedReviews(tutorId: string): Promise<any[]>;
  getAllReviews(tutorId: string): Promise<any[]>;
  setReviewApproval(id: string, tutorId: string, approved: boolean): Promise<any | undefined>;
  deleteReview(id: string, tutorId: string): Promise<void>;
}

function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj !== 'object') return obj;
  
  const result: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = snakeToCamel(obj[key]);
  }
  return result;
}

function camelToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (obj instanceof Date) return obj.toISOString();
  if (typeof obj !== 'object') return obj;
  
  const result: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = camelToSnake(obj[key]);
  }
  return result;
}

export class SupabaseStorage implements IStorage {
  async getTutor(id: string): Promise<Tutor | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Tutor;
  }

  async getTutorByEmail(email: string): Promise<Tutor | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .select('*')
      .eq('email', email)
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Tutor;
  }

  async getTutorBySlug(slug: string): Promise<Tutor | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .select('*')
      .eq('public_slug', slug)
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Tutor;
  }

  async getTutorByBotToken(token: string): Promise<Tutor | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .select('*')
      .eq('bot_token', token)
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Tutor;
  }

  async setBotToken(tutorId: string, token: string): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .update({ bot_token: token })
      .eq('id', tutorId);
  }

  async createTutor(tutor: InsertTutor): Promise<Tutor> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .insert(camelToSnake(tutor))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as Tutor;
  }

  async updateTutor(id: string, updates: Partial<InsertTutor>): Promise<Tutor | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .update(camelToSnake(updates))
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Tutor;
  }

  async deleteTutor(id: string): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async getAllTutors(): Promise<Tutor[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Tutor[];
  }

  async getStudentsByTutorId(tutorId: string): Promise<Student[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}students`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Student[];
  }

  async countActiveStudents(tutorId: string): Promise<number> {
    const { count, error } = await supabase
      .from(`${TABLE_PREFIX}students`)
      .select('*', { count: 'exact', head: true })
      .eq('tutor_id', tutorId)
      .eq('is_active', true);
    if (error) throw new Error(error.message);
    return count || 0;
  }

  async getStudent(id: string): Promise<Student | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}students`)
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Student;
  }

  async getStudentByEmail(email: string): Promise<Student | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}students`)
      .select('*')
      .eq('email', email)
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Student;
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}students`)
      .insert(camelToSnake(student))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as Student;
  }

  async updateStudent(id: string, updates: Partial<InsertStudent>): Promise<Student | undefined> {
    const snakeUpdates = camelToSnake(updates);
    console.log(`[storage] updateStudent id=${id}, keys=${Object.keys(snakeUpdates).join(',')}`);
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}students`)
      .update(snakeUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error(`[storage] updateStudent ERROR:`, error.message, error.details, error.hint);
      throw new Error(`Update failed: ${error.message}`);
    }
    if (!data) return undefined;
    return snakeToCamel(data) as Student;
  }

  async deleteStudent(id: string): Promise<void> {
    await supabase.from(`${TABLE_PREFIX}students`).delete().eq('id', id);
  }

  async getStudentByTelegramChatId(chatId: string): Promise<Student | undefined> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}students`)
      .select('*')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();
    return data ? snakeToCamel(data) as Student : undefined;
  }

  async getTutorByTelegramChatId(chatId: string): Promise<Tutor | undefined> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .select('*')
      .eq('tutor_chat_id', chatId)
      .maybeSingle();
    return data ? snakeToCamel(data) as Tutor : undefined;
  }

  async getLessonsByTutorId(tutorId: string, limit?: number): Promise<Lesson[]> {
    // Fetch only active students to exclude archived ones
    const { data: activeStudents } = await supabase
      .from(`${TABLE_PREFIX}students`)
      .select('id')
      .eq('tutor_id', tutorId)
      .eq('is_active', true);
    const activeIds = (activeStudents || []).map((s: any) => s.id);
    if (activeIds.length === 0) return [];

    let query = supabase
      .from(`${TABLE_PREFIX}lessons`)
      .select('*')
      .eq('tutor_id', tutorId)
      .in('student_id', activeIds)
      .order('scheduled_at', { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Lesson[];
  }

  async getLesson(id: string): Promise<Lesson | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}lessons`)
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Lesson;
  }

  async createLesson(lesson: InsertLesson): Promise<Lesson> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}lessons`)
      .insert(camelToSnake(lesson))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as Lesson;
  }

  async updateLesson(id: string, updates: Partial<InsertLesson>): Promise<Lesson | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}lessons`)
      .update(camelToSnake(updates))
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Lesson;
  }

  async deleteLesson(id: string): Promise<void> {
    await supabase.from(`${TABLE_PREFIX}lessons`).delete().eq('id', id);
  }

  async getPaymentsByTutorId(tutorId: string, limit?: number): Promise<Payment[]> {
    let query = supabase
      .from(`${TABLE_PREFIX}payments`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Payment[];
  }

  async getAllPayments(limit: number = 500): Promise<Payment[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}payments`)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Payment[];
  }

  async getPaymentsByStudentId(studentId: string, limit?: number): Promise<Payment[]> {
    let query = supabase
      .from(`${TABLE_PREFIX}payments`)
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Payment[];
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}payments`)
      .insert(camelToSnake(payment))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as Payment;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}payments`)
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Payment;
  }

  async updatePayment(id: string, updates: Partial<Record<string, any>>): Promise<Payment | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}payments`)
      .update(camelToSnake(updates))
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Payment;
  }

  async deletePayment(id: string): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}payments`)
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async getTasksByTutorId(tutorId: string, limit?: number): Promise<Task[]> {
    let query = supabase
      .from(`${TABLE_PREFIX}tasks`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Task[];
  }

  async createTask(task: InsertTask): Promise<Task> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tasks`)
      .insert(camelToSnake(task))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as Task;
  }

  async deleteTasks(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await supabase.from(`${TABLE_PREFIX}tasks`).delete().in('id', ids);
  }

  async getHomeworkByTutorId(tutorId: string, limit?: number): Promise<Homework[]> {
    let query = supabase
      .from(`${TABLE_PREFIX}homework`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Homework[];
  }

  async getHomeworkByStudentId(studentId: string, limit?: number): Promise<Homework[]> {
    let query = supabase
      .from(`${TABLE_PREFIX}homework`)
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Homework[];
  }

  async getHomework(id: string): Promise<Homework | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}homework`)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? snakeToCamel(data) as Homework : undefined;
  }

  async createHomework(hw: InsertHomework): Promise<Homework> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}homework`)
      .insert(camelToSnake(hw))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as Homework;
  }

  async updateHomework(id: string, updates: Partial<InsertHomework>): Promise<Homework | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}homework`)
      .update(camelToSnake(updates))
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Homework;
  }

  async getSubscriptionPrices(): Promise<SubscriptionPrice[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}subscription_prices`)
      .select('*');
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as SubscriptionPrice[];
  }

  async updateSubscriptionPrice(tier: string, updates: Partial<InsertSubscriptionPrice>): Promise<SubscriptionPrice | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}subscription_prices`)
      .update({ ...camelToSnake(updates), updated_at: new Date().toISOString() })
      .eq('tier', tier)
      .select()
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as SubscriptionPrice;
  }

  async getAllSubscriptionPayments(limit: number = 500): Promise<SubscriptionPayment[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}subscription_payments`)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as SubscriptionPayment[];
  }

  async getSubscriptionPaymentsByTutorId(tutorId: string): Promise<SubscriptionPayment[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}subscription_payments`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as SubscriptionPayment[];
  }

  async createSubscriptionPayment(payment: InsertSubscriptionPayment): Promise<SubscriptionPayment> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}subscription_payments`)
      .insert(camelToSnake(payment))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as SubscriptionPayment;
  }

  async updateSubscriptionPayment(id: string, updates: Partial<InsertSubscriptionPayment>): Promise<SubscriptionPayment | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}subscription_payments`)
      .update(camelToSnake(updates))
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as SubscriptionPayment;
  }

  async getSubscriptionPaymentByYookassaId(yookassaId: string): Promise<SubscriptionPayment | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}subscription_payments`)
      .select('*')
      .eq('yookassa_payment_id', yookassaId)
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as SubscriptionPayment;
  }

  async getNotificationsByTutorId(tutorId: string, limit = 50): Promise<Notification[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}notifications`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Notification[];
  }

  async getUnreadNotificationsCount(tutorId: string): Promise<number> {
    const { count, error } = await supabase
      .from(`${TABLE_PREFIX}notifications`)
      .select('*', { count: 'exact', head: true })
      .eq('tutor_id', tutorId)
      .eq('is_read', false);
    if (error) throw new Error(error.message);
    return count || 0;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}notifications`)
      .insert(camelToSnake(notification))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as Notification;
  }

  async markNotificationRead(id: string): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}notifications`)
      .update({ is_read: true })
      .eq('id', id);
  }

  async markAllNotificationsRead(tutorId: string): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}notifications`)
      .update({ is_read: true })
      .eq('tutor_id', tutorId);
  }

  async createStudentApplication(app: InsertStudentApplication): Promise<StudentApplication> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}student_applications`)
      .insert(camelToSnake(app))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as StudentApplication;
  }

  async getStudentApplicationsByTutor(tutorId: string, status?: string): Promise<StudentApplication[]> {
    let q = supabase
      .from(`${TABLE_PREFIX}student_applications`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as StudentApplication[];
  }

  async getStudentApplication(id: string): Promise<StudentApplication | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}student_applications`)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return undefined;
    return snakeToCamel(data) as StudentApplication;
  }

  async updateStudentApplicationStatus(id: string, status: string, studentId?: string): Promise<StudentApplication | undefined> {
    const updates: any = { status };
    if (studentId !== undefined) updates.student_id = studentId;
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}student_applications`)
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error || !data) return undefined;
    return snakeToCamel(data) as StudentApplication;
  }

  async getPendingApplicationsCountByTutor(tutorId: string): Promise<number> {
    const { count, error } = await supabase
      .from(`${TABLE_PREFIX}student_applications`)
      .select('*', { count: 'exact', head: true })
      .eq('tutor_id', tutorId)
      .eq('status', 'pending');
    if (error) return 0;
    return count || 0;
  }

  async getLessonTemplatesByTutorId(tutorId: string): Promise<LessonTemplate[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}lesson_templates`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as LessonTemplate[];
  }

  async getPublicLessonTemplates(): Promise<LessonTemplate[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}lesson_templates`)
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as LessonTemplate[];
  }

  async getLessonTemplate(id: string): Promise<LessonTemplate | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}lesson_templates`)
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as LessonTemplate;
  }

  async createLessonTemplate(template: InsertLessonTemplate): Promise<LessonTemplate> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}lesson_templates`)
      .insert(camelToSnake(template))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as LessonTemplate;
  }

  async updateLessonTemplate(id: string, updates: Partial<InsertLessonTemplate>): Promise<LessonTemplate | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}lesson_templates`)
      .update(camelToSnake(updates))
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as LessonTemplate;
  }

  async deleteLessonTemplate(id: string): Promise<void> {
    await supabase.from(`${TABLE_PREFIX}lesson_templates`).delete().eq('id', id);
  }

  async createPasswordResetToken(tutorId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}password_reset_tokens`)
      .insert({ tutor_id: tutorId, token, expires_at: expiresAt.toISOString() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as PasswordResetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}password_reset_tokens`)
      .select('*')
      .eq('token', token)
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as PasswordResetToken;
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}password_reset_tokens`)
      .update({ used_at: new Date().toISOString() })
      .eq('id', id);
  }

  // V3.6: Email verification
  async createEmailVerificationToken(tutorId: string, token: string, expiresAt: Date): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}email_verification_tokens`)
      .insert({ tutor_id: tutorId, token, expires_at: expiresAt.toISOString() });
    if (error) throw new Error(error.message);
  }

  async getEmailVerificationToken(token: string): Promise<{ id: string; tutorId: string; expiresAt: string; usedAt: string | null } | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}email_verification_tokens`)
      .select('*')
      .eq('token', token)
      .single();
    if (error || !data) return undefined;
    return { id: data.id, tutorId: data.tutor_id, expiresAt: data.expires_at, usedAt: data.used_at };
  }

  async markEmailVerificationTokenUsed(id: string): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}email_verification_tokens`)
      .update({ used_at: new Date().toISOString() })
      .eq('id', id);
  }

  // Student email verification
  async createStudentEmailVerificationToken(studentId: string, token: string, expiresAt: Date): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}student_email_verification_tokens`)
      .insert({ student_id: studentId, token, expires_at: expiresAt.toISOString() });
    if (error) throw new Error(error.message);
  }
  async getStudentEmailVerificationToken(token: string) {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}student_email_verification_tokens`)
      .select('*')
      .eq('token', token)
      .single();
    if (error || !data) return undefined;
    return { id: data.id, studentId: data.student_id, expiresAt: data.expires_at, usedAt: data.used_at };
  }
  async markStudentEmailVerificationTokenUsed(id: string): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}student_email_verification_tokens`)
      .update({ used_at: new Date().toISOString() })
      .eq('id', id);
  }

  // Student password reset
  async createStudentPasswordResetToken(studentId: string, token: string, expiresAt: Date): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}student_password_reset_tokens`)
      .insert({ student_id: studentId, token, expires_at: expiresAt.toISOString() });
    if (error) throw new Error(error.message);
  }
  async getStudentPasswordResetToken(token: string) {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}student_password_reset_tokens`)
      .select('*')
      .eq('token', token)
      .single();
    if (error || !data) return undefined;
    return { id: data.id, studentId: data.student_id, expiresAt: data.expires_at, usedAt: data.used_at };
  }
  async markStudentPasswordResetTokenUsed(id: string): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}student_password_reset_tokens`)
      .update({ used_at: new Date().toISOString() })
      .eq('id', id);
  }

  // V3.6: Referrals
  async getTutorByReferralCode(code: string): Promise<Tutor | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .select('*')
      .eq('referral_code', code)
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Tutor;
  }

  async getReferredTutors(tutorId: string): Promise<Tutor[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .select('*')
      .eq('referred_by', tutorId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data || []).map(snakeToCamel) as Tutor[];
  }

  // V3.6: 2FA
  async createTwoFactorCode(tutorId: string, code: string, expiresAt: Date): Promise<void> {
    // Invalidate old codes first
    await supabase
      .from(`${TABLE_PREFIX}two_factor_codes`)
      .update({ used_at: new Date().toISOString() })
      .eq('tutor_id', tutorId)
      .is('used_at', null);

    const { error } = await supabase
      .from(`${TABLE_PREFIX}two_factor_codes`)
      .insert({ tutor_id: tutorId, code, expires_at: expiresAt.toISOString() });
    if (error) throw new Error(error.message);
  }

  async verifyTwoFactorCode(tutorId: string, code: string): Promise<boolean> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}two_factor_codes`)
      .select('*')
      .eq('tutor_id', tutorId)
      .eq('code', code)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (!data) return false;
    if (new Date(data.expires_at) < new Date()) return false;
    await supabase
      .from(`${TABLE_PREFIX}two_factor_codes`)
      .update({ used_at: new Date().toISOString() })
      .eq('id', data.id);
    return true;
  }

  // Student portal methods
  async createStudentAccessToken(studentId: string, _unusedToken?: string): Promise<StudentAccessToken> {
    const token = generateStudentToken(studentId);
    const now = new Date().toISOString();
    return {
      id: `hmac-${studentId}-${Date.now()}`,
      studentId,
      token,
      isActive: true,
      createdAt: now,
      lastUsedAt: null,
    } as unknown as StudentAccessToken;
  }

  async getStudentAccessToken(token: string): Promise<StudentAccessToken | undefined> {
    const decoded = verifyStudentToken(token);
    if (!decoded) return undefined;
    const now = new Date().toISOString();
    return {
      id: decoded.id,
      studentId: decoded.studentId,
      token,
      isActive: true,
      createdAt: now,
      lastUsedAt: null,
    } as unknown as StudentAccessToken;
  }

  async getStudentAccessTokensByStudentId(_studentId: string): Promise<StudentAccessToken[]> {
    return [];
  }

  async updateStudentAccessTokenLastUsed(_id: string): Promise<void> {
    // HMAC tokens are stateless — nothing to update
  }

  async deactivateStudentAccessToken(_id: string): Promise<void> {
    // HMAC tokens are stateless — cannot be revoked without a blocklist table
  }

  // AI chat methods
  async getAiChatsByStudentId(studentId: string): Promise<AiChat[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_chats`)
      .select('*')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as AiChat[];
  }

  async getAiChat(chatId: string): Promise<AiChat | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_chats`)
      .select('*')
      .eq('id', chatId)
      .single();
    if (error) return undefined;
    return snakeToCamel(data) as AiChat;
  }

  async createAiChat(chat: InsertAiChat): Promise<AiChat> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_chats`)
      .insert(camelToSnake(chat))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as AiChat;
  }

  async updateAiChatTitle(chatId: string, title: string): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}ai_chats`)
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', chatId);
    if (error) throw new Error(error.message);
  }

  async deleteAiChat(chatId: string): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}ai_chats`)
      .delete()
      .eq('id', chatId);
    if (error) throw new Error(error.message);
  }

  async getAiChatMessagesByChatId(chatId: string, limit = 100): Promise<AiChatMessage[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_chat_messages`)
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as AiChatMessage[];
  }

  async getAiChatMessagesByStudentId(studentId: string, limit = 100): Promise<AiChatMessage[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_chat_messages`)
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as AiChatMessage[];
  }

  async getAiChatMessagesByHomeworkId(homeworkId: string, limit = 100): Promise<AiChatMessage[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_chat_messages`)
      .select('*')
      .eq('homework_id', homeworkId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as AiChatMessage[];
  }

  async createAiChatMessage(message: InsertAiChatMessage): Promise<AiChatMessage> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_chat_messages`)
      .insert(camelToSnake(message))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as AiChatMessage;
  }

  // Student lessons
  async getLessonsByStudentId(studentId: string, limit?: number): Promise<Lesson[]> {
    let query = supabase
      .from(`${TABLE_PREFIX}lessons`)
      .select('*')
      .eq('student_id', studentId)
      .order('scheduled_at', { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Lesson[];
  }

  // AI settings
  async getAiSettings(): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_settings`)
      .select('*');
    if (error) throw new Error(error.message);
    const result: Record<string, string> = {};
    for (const row of data || []) {
      result[row.key] = row.value;
    }
    return result;
  }

  async getAiSetting(key: string): Promise<string | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_settings`)
      .select('value')
      .eq('key', key)
      .single();
    if (error) return undefined;
    return data?.value;
  }

  async setAiSetting(key: string, value: string): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}ai_settings`)
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
  }

  // AI usage tracking
  async getAiUsageToday(studentId: string, model: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_usage`)
      .select('count')
      .eq('student_id', studentId)
      .eq('model', model)
      .eq('usage_date', today)
      .single();
    if (error) return 0;
    return data?.count || 0;
  }

  async incrementAiUsage(studentId: string, model: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const current = await this.getAiUsageToday(studentId, model);
    if (current > 0) {
      await supabase
        .from(`${TABLE_PREFIX}ai_usage`)
        .update({ count: current + 1 })
        .eq('student_id', studentId)
        .eq('model', model)
        .eq('usage_date', today);
    } else {
      await supabase
        .from(`${TABLE_PREFIX}ai_usage`)
        .insert({ student_id: studentId, model, usage_date: today, count: 1 });
    }
  }
  // Tutor AI chat methods
  async getTutorAiChatsByTutorId(tutorId: string): Promise<TutorAiChat[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutor_ai_chats`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as TutorAiChat[];
  }

  async getTutorAiChat(chatId: string): Promise<TutorAiChat | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutor_ai_chats`)
      .select('*')
      .eq('id', chatId)
      .single();
    if (error) return undefined;
    return snakeToCamel(data) as TutorAiChat;
  }

  async createTutorAiChat(chat: InsertTutorAiChat): Promise<TutorAiChat> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutor_ai_chats`)
      .insert(camelToSnake(chat))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as TutorAiChat;
  }

  async updateTutorAiChatTitle(chatId: string, title: string): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}tutor_ai_chats`)
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', chatId);
    if (error) throw new Error(error.message);
  }

  async deleteTutorAiChat(chatId: string): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}tutor_ai_chats`)
      .delete()
      .eq('id', chatId);
    if (error) throw new Error(error.message);
  }

  async getTutorAiChatMessagesByChatId(chatId: string, limit = 100): Promise<TutorAiChatMessage[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutor_ai_chat_messages`)
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as TutorAiChatMessage[];
  }

  async createTutorAiChatMessage(message: InsertTutorAiChatMessage): Promise<TutorAiChatMessage> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutor_ai_chat_messages`)
      .insert(camelToSnake(message))
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabase
      .from(`${TABLE_PREFIX}tutor_ai_chats`)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', message.chatId);

    return snakeToCamel(data) as TutorAiChatMessage;
  }

  async getTutorAiUsageToday(tutorId: string, model: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutor_ai_usage`)
      .select('count')
      .eq('tutor_id', tutorId)
      .eq('model', model)
      .eq('usage_date', today)
      .single();
    if (error) return 0;
    return data?.count || 0;
  }

  async incrementTutorAiUsage(tutorId: string, model: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const current = await this.getTutorAiUsageToday(tutorId, model);
    if (current > 0) {
      await supabase
        .from(`${TABLE_PREFIX}tutor_ai_usage`)
        .update({ count: current + 1 })
        .eq('tutor_id', tutorId)
        .eq('model', model)
        .eq('usage_date', today);
    } else {
      await supabase
        .from(`${TABLE_PREFIX}tutor_ai_usage`)
        .insert({ tutor_id: tutorId, model, usage_date: today, count: 1 });
    }
  }

  async getAiPackageBalance(ownerId: string, ownerType: 'tutor' | 'student'): Promise<number> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_packages`)
      .select('credits, used_credits')
      .eq('owner_id', ownerId)
      .eq('owner_type', ownerType);
    if (error || !data) return 0;
    return data.reduce((sum, pkg) => sum + Math.max(0, pkg.credits - pkg.used_credits), 0);
  }

  async getAiPackages(ownerId: string, ownerType: 'tutor' | 'student'): Promise<any[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_packages`)
      .select('*')
      .eq('owner_id', ownerId)
      .eq('owner_type', ownerType)
      .order('purchased_at', { ascending: false });
    if (error) return [];
    return (data || []).map(snakeToCamel);
  }

  async purchaseAiPackage(ownerId: string, ownerType: 'tutor' | 'student', credits: number, pricePaid: number): Promise<any> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_packages`)
      .insert({
        owner_id: ownerId,
        owner_type: ownerType,
        credits,
        used_credits: 0,
        price_paid: pricePaid,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data);
  }

  async consumeAiPackageCredit(ownerId: string, ownerType: 'tutor' | 'student'): Promise<boolean> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}ai_packages`)
      .select('id, credits, used_credits')
      .eq('owner_id', ownerId)
      .eq('owner_type', ownerType)
      .order('purchased_at', { ascending: true });
    if (error || !data) return false;

    const available = data.find(pkg => pkg.used_credits < pkg.credits);
    if (!available) return false;

    await supabase
      .from(`${TABLE_PREFIX}ai_packages`)
      .update({ used_credits: available.used_credits + 1 })
      .eq('id', available.id);
    return true;
  }

  // ─── Homework Templates ───────────────────────────────────────────────────
  async getHomeworkTemplatesByTutorId(tutorId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}homework_templates`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data || []).map(snakeToCamel);
  }

  async createHomeworkTemplate(template: any): Promise<any> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}homework_templates`)
      .insert(camelToSnake(template))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data);
  }

  async updateHomeworkTemplate(id: string, updates: any): Promise<any> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}homework_templates`)
      .update(camelToSnake(updates))
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data);
  }

  async deleteHomeworkTemplate(id: string): Promise<void> {
    await supabase.from(`${TABLE_PREFIX}homework_templates`).delete().eq('id', id);
  }

  // ─── Student Notes ────────────────────────────────────────────────────────
  async getStudentNote(studentId: string): Promise<any | null> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}student_notes`)
      .select('*')
      .eq('student_id', studentId)
      .single();
    if (!data) return null;
    return snakeToCamel(data);
  }

  async upsertStudentNote(studentId: string, content: string): Promise<any> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}student_notes`)
      .upsert({ student_id: studentId, content, updated_at: new Date().toISOString() }, { onConflict: 'student_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data);
  }

  // ─── Direct Messages ──────────────────────────────────────────────────────
  async getDirectMessagesByStudentId(studentId: string, limit = 100): Promise<any[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}direct_messages`)
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) return [];
    return (data || []).map(snakeToCamel);
  }

  async createDirectMessage(msg: any): Promise<any> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}direct_messages`)
      .insert(camelToSnake(msg))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data);
  }

  async markDirectMessagesRead(studentId: string, readerRole: string): Promise<void> {
    // Tutor sees inbound from student AND parent; student/parent see inbound from tutor.
    const senderRoles = readerRole === 'tutor' ? ['student', 'parent'] : ['tutor'];
    await supabase
      .from(`${TABLE_PREFIX}direct_messages`)
      .update({ is_read: true })
      .eq('student_id', studentId)
      .in('role', senderRoles)
      .eq('is_read', false);
  }

  async getUnreadDirectMessageCount(studentId: string, readerRole: string): Promise<number> {
    const senderRoles = readerRole === 'tutor' ? ['student', 'parent'] : ['tutor'];
    const { count } = await supabase
      .from(`${TABLE_PREFIX}direct_messages`)
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .in('role', senderRoles)
      .eq('is_read', false);
    return count || 0;
  }

  async getDirectMessageById(id: string): Promise<any | null> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}direct_messages`)
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return snakeToCamel(data);
  }

  async deleteDirectMessage(id: string): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}direct_messages`)
      .delete()
      .eq('id', id);
  }

  // ─── Monthly Goals ────────────────────────────────────────────────────────
  async getTutorMonthlyGoals(tutorId: string): Promise<any> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .select('monthly_goals')
      .eq('id', tutorId)
      .single();
    return (data as any)?.monthly_goals || {};
  }

  async updateTutorMonthlyGoals(tutorId: string, goals: any): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}tutors`)
      .update({ monthly_goals: goals })
      .eq('id', tutorId);
  }

  // ─── Tutor Notes on Student ───────────────────────────────────────────────
  async updateStudentTutorNotes(studentId: string, notes: string): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}students`)
      .update({ tutor_notes: notes })
      .eq('id', studentId);
  }

  // ─── BBB Conferences ──────────────────────────────────────────────────────
  async getConferencesByTutorId(tutorId: string): Promise<Conference[]> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}conferences`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    return (data || []).map(snakeToCamel) as Conference[];
  }

  async getConference(id: string): Promise<Conference | undefined> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}conferences`)
      .select('*')
      .eq('id', id)
      .single();
    if (!data) return undefined;
    return snakeToCamel(data) as Conference;
  }

  async getConferenceByStudentId(studentId: string): Promise<Conference | undefined> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}conferences`)
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return undefined;
    return snakeToCamel(data) as Conference;
  }

  async createConference(conf: InsertConference): Promise<Conference> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}conferences`)
      .insert(camelToSnake(conf))
      .select()
      .single();
    if (error || !data) throw new Error(error?.message || 'Failed to create conference');
    return snakeToCamel(data) as Conference;
  }

  async updateConference(id: string, data: Partial<InsertConference>): Promise<Conference> {
    const { data: updated, error } = await supabase
      .from(`${TABLE_PREFIX}conferences`)
      .update(camelToSnake(data))
      .eq('id', id)
      .select()
      .single();
    if (error || !updated) throw new Error(error?.message || 'Failed to update conference');
    return snakeToCamel(updated) as Conference;
  }

  async deleteConference(id: string): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}conferences`)
      .delete()
      .eq('id', id);
  }

  // ─── Feature Flags ──────────────────────────────────────────────────────────
  async getFeatureFlagsByTutorId(tutorId: string): Promise<FeatureFlag[]> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}feature_flags`)
      .select('*')
      .eq('tutor_id', tutorId);
    return (data || []) as FeatureFlag[];
  }

  async upsertFeatureFlag(tutorId: string, feature: string, enabled: boolean): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}feature_flags`)
      .upsert({ tutor_id: tutorId, feature, enabled }, { onConflict: 'tutor_id,feature' });
  }

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}feature_flags`)
      .select('*')
      .order('created_at', { ascending: false });
    return (data || []) as FeatureFlag[];
  }

  // ─── Support Tickets ────────────────────────────────────────────────────────
  async getSupportTicketsByTutorId(tutorId: string): Promise<SupportTicket[]> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}support_tickets`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('updated_at', { ascending: false });
    return (data || []) as SupportTicket[];
  }

  async getAllSupportTickets(): Promise<SupportTicket[]> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}support_tickets`)
      .select('*')
      .order('updated_at', { ascending: false });
    return (data || []) as SupportTicket[];
  }

  async getSupportTicket(id: string): Promise<SupportTicket | undefined> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}support_tickets`)
      .select('*')
      .eq('id', id)
      .single();
    return data as SupportTicket | undefined;
  }

  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}support_tickets`)
      .insert({ tutor_id: ticket.tutorId, subject: ticket.subject, status: 'open' })
      .select()
      .single();
    return data as SupportTicket;
  }

  async updateSupportTicketStatus(id: string, status: string): Promise<void> {
    await supabase
      .from(`${TABLE_PREFIX}support_tickets`)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  async getSupportMessagesByTicketId(ticketId: string): Promise<SupportMessage[]> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}support_messages`)
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    return (data || []) as SupportMessage[];
  }

  async createSupportMessage(msg: InsertSupportMessage): Promise<SupportMessage> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}support_messages`)
      .insert({ ticket_id: msg.ticketId, role: msg.role, content: msg.content })
      .select()
      .single();
    // update ticket updated_at
    await supabase
      .from(`${TABLE_PREFIX}support_tickets`)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', msg.ticketId);
    return data as SupportMessage;
  }

  // ===== TASK BANK =====
  async getTaskBankMeta(): Promise<{ subjects: string[]; classes: string[]; topics: string[]; difficulties: string[] }> {
    const [s, c, t, d] = await Promise.all([
      supabase.from('Online School Tasks').select('subject').limit(1000),
      supabase.from('Online School Tasks').select('class').limit(1000),
      supabase.from('Online School Tasks').select('topic').limit(1000),
      supabase.from('Online School Tasks').select('difficulty').limit(1000),
    ]);
    const unique = (arr: any[], key: string) => Array.from(new Set((arr || []).map((r: any) => r[key]).filter(Boolean))).sort() as string[];
    return {
      subjects: unique(s.data || [], 'subject'),
      classes: unique(c.data || [], 'class'),
      topics: unique(t.data || [], 'topic').sort((a: string, b: string) => {
        const na = parseInt(a.replace(/\D/g, '')) || 0;
        const nb = parseInt(b.replace(/\D/g, '')) || 0;
        return na - nb;
      }),
      difficulties: unique(d.data || [], 'difficulty'),
    };
  }

  async getTaskBank(filters: { subject?: string; class?: string; topic?: string; difficulty?: string; search?: string }, page: number, limit: number): Promise<{ tasks: any[]; total: number }> {
    let query = supabase.from('Online School Tasks').select('*', { count: 'exact' });
    if (filters.subject) query = query.eq('subject', filters.subject);
    if (filters.class) query = query.eq('class', filters.class);
    if (filters.topic) query = query.eq('topic', filters.topic);
    if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
    if (filters.search) query = query.ilike('condition', `%${filters.search}%`);
    const { data, count, error } = await query
      .order('topic', { ascending: true })
      .order('created_at', { ascending: true })
      .range(page * limit, (page + 1) * limit - 1);
    if (error) throw new Error(error.message);
    return { tasks: data || [], total: count || 0 };
  }

  async getTaskById(id: string): Promise<any | undefined> {
    const { data, error } = await supabase
      .from('Online School Tasks')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return undefined;
    return data;
  }

  async getRandomTask(filters: { subject?: string; class?: string; topic?: string; difficulty?: string }): Promise<any | null> {
    let countQ = supabase.from('Online School Tasks').select('id', { count: 'exact', head: true });
    if (filters.subject) countQ = countQ.eq('subject', filters.subject);
    if (filters.class) countQ = countQ.eq('class', filters.class);
    if (filters.topic) countQ = countQ.eq('topic', filters.topic);
    if (filters.difficulty) countQ = countQ.eq('difficulty', filters.difficulty);
    const { count } = await countQ;
    if (!count || count === 0) return null;
    const offset = Math.floor(Math.random() * count);
    let dataQ = supabase.from('Online School Tasks').select('*');
    if (filters.subject) dataQ = dataQ.eq('subject', filters.subject);
    if (filters.class) dataQ = dataQ.eq('class', filters.class);
    if (filters.topic) dataQ = dataQ.eq('topic', filters.topic);
    if (filters.difficulty) dataQ = dataQ.eq('difficulty', filters.difficulty);
    const { data } = await dataQ.range(offset, offset);
    return data?.[0] || null;
  }

  async getRandomTasksForGroups(
    groups: Array<{ topic: string; class?: string; difficulty?: string; count: number }>,
    excludeIds: string[] = []
  ): Promise<any[]> {
    const result: any[] = [];
    const usedIds = new Set<string>(excludeIds);

    for (const group of groups) {
      const clampedCount = Math.max(1, Math.min(group.count || 1, 30));
      const poolSize = Math.min(clampedCount * 6, 200);

      let q = supabase.from('Online School Tasks').select('*');
      if (group.topic) q = q.eq('topic', group.topic);
      if (group.class) q = q.eq('class', group.class);
      if (group.difficulty) q = q.eq('difficulty', group.difficulty);
      if (usedIds.size > 0) q = (q as any).not('id', 'in', `(${Array.from(usedIds).join(',')})`);
      q = q.limit(poolSize);

      const { data } = await q;
      if (!data || data.length === 0) continue;

      const shuffled = [...data].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, clampedCount);
      for (const task of picked) {
        usedIds.add(task.id);
        result.push(task);
      }
    }

    return result;
  }

  async getTasksByIds(ids: string[]): Promise<any[]> {
    if (!ids || ids.length === 0) return [];
    const { data } = await supabase
      .from('Online School Tasks')
      .select('*')
      .in('id', ids);
    if (!data) return [];
    const map = Object.fromEntries(data.map((t: any) => [t.id, t]));
    return ids.map(id => map[id]).filter(Boolean);
  }

  async getVariantsByTutor(tutorId: string): Promise<any[]> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}task_variants`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    return (data || []).map(snakeToCamel);
  }

  async getVariantById(id: string): Promise<any | undefined> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}task_variants`)
      .select('*')
      .eq('id', id)
      .single();
    if (!data) return undefined;
    return snakeToCamel(data);
  }

  async createVariant(tutorId: string, name: string, taskIds: string[]): Promise<any> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}task_variants`)
      .insert({ tutor_id: tutorId, name, task_ids: taskIds })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data);
  }

  async updateVariant(id: string, updates: { name?: string; taskIds?: string[] }): Promise<any> {
    const patch: any = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.taskIds !== undefined) patch.task_ids = updates.taskIds;
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}task_variants`)
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data);
  }

  async deleteVariant(id: string): Promise<void> {
    await supabase.from(`${TABLE_PREFIX}task_variants`).delete().eq('id', id);
  }

  async assignVariant(variantId: string, studentIds: string[], tutorId: string): Promise<void> {
    // Remove old assignments for this variant
    await supabase.from(`${TABLE_PREFIX}variant_assignments`).delete().eq('variant_id', variantId);
    if (studentIds.length === 0) return;
    const rows = studentIds.map(sid => ({ variant_id: variantId, student_id: sid, tutor_id: tutorId, status: 'assigned' }));
    const { error } = await supabase.from(`${TABLE_PREFIX}variant_assignments`).insert(rows);
    if (error) throw new Error(error.message);
  }

  async getStudentVariants(studentId: string): Promise<any[]> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}variant_assignments`)
      .select('*, variant:Tvoy_vector_2_task_variants(*)')
      .eq('student_id', studentId)
      .order('assigned_at', { ascending: false });
    return (data || []).map((row: any) => ({
      ...snakeToCamel(row),
      variant: row.variant ? snakeToCamel(row.variant) : null,
    }));
  }

  async getStudentVariantById(variantId: string, studentId: string): Promise<any | undefined> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}variant_assignments`)
      .select('*, variant:Tvoy_vector_2_task_variants(*)')
      .eq('variant_id', variantId)
      .eq('student_id', studentId)
      .single();
    if (!data) return undefined;
    return { ...snakeToCamel(data), variant: data.variant ? snakeToCamel(data.variant) : null };
  }

  async getSavedLessonPlans(tutorId: string): Promise<SavedLessonPlan[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}saved_lesson_plans`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as SavedLessonPlan[];
  }

  async createSavedLessonPlan(plan: InsertSavedLessonPlan): Promise<SavedLessonPlan> {
    const row = camelToSnake(plan);
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}saved_lesson_plans`)
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as SavedLessonPlan;
  }

  async deleteSavedLessonPlan(id: string, tutorId: string): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}saved_lesson_plans`)
      .delete()
      .eq('id', id)
      .eq('tutor_id', tutorId);
    if (error) throw new Error(error.message);
  }

  async getBackupsByTutorId(tutorId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}backups`)
      .select('id, tutor_id, type, note, size_bytes, created_at')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    if (error) {
      if (error.code === '42P01') return [];
      throw new Error(error.message);
    }
    return (data || []).map(snakeToCamel);
  }

  async getBackupById(id: string): Promise<any | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}backups`)
      .select('*')
      .eq('id', id)
      .single();
    if (error) return undefined;
    return snakeToCamel(data);
  }

  async createBackup(tutorId: string, type: string, note: string | null, dataJson: string): Promise<any> {
    const sizeBytes = Buffer.byteLength(dataJson, 'utf8');
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}backups`)
      .insert({ tutor_id: tutorId, type, note, size_bytes: sizeBytes, data_json: dataJson })
      .select('id, tutor_id, type, note, size_bytes, created_at')
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data);
  }

  async deleteBackup(id: string): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}backups`)
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteOldAutoBackups(tutorId: string, keepCount: number): Promise<void> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}backups`)
      .select('id')
      .eq('tutor_id', tutorId)
      .eq('type', 'auto')
      .order('created_at', { ascending: false });
    if (error || !data) return;
    const toDelete = data.slice(keepCount).map((r: any) => r.id);
    if (toDelete.length === 0) return;
    await supabase.from(`${TABLE_PREFIX}backups`).delete().in('id', toDelete);
  }

  async createReview(input: { tutorId: string; authorName: string; authorContact: string | null; rating: number; text: string }): Promise<any> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutor_reviews`)
      .insert({
        tutor_id: input.tutorId,
        author_name: input.authorName,
        author_contact: input.authorContact,
        rating: input.rating,
        text: input.text,
        is_approved: false,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data);
  }

  async getApprovedReviews(tutorId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutor_reviews`)
      .select('id, author_name, rating, text, created_at')
      .eq('tutor_id', tutorId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data.map(snakeToCamel);
  }

  async getAllReviews(tutorId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutor_reviews`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error || !data) return [];
    return data.map(snakeToCamel);
  }

  async setReviewApproval(id: string, tutorId: string, approved: boolean): Promise<any | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}tutor_reviews`)
      .update({ is_approved: approved })
      .eq('id', id)
      .eq('tutor_id', tutorId)
      .select('*')
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data);
  }

  async deleteReview(id: string, tutorId: string): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}tutor_reviews`)
      .delete()
      .eq('id', id)
      .eq('tutor_id', tutorId);
    if (error) throw new Error(error.message);
  }

  // ===== Quizzes =====
  async getQuizzesByTutor(tutorId: string): Promise<Quiz[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}quizzes`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Quiz[];
  }

  async getQuizzesAvailableToStudent(studentId: string): Promise<Quiz[]> {
    // Узнаём репетитора ученика
    const { data: st, error: e1 } = await supabase
      .from(`${TABLE_PREFIX}students`)
      .select('tutor_id')
      .eq('id', studentId)
      .single();
    if (e1 || !st) return [];
    const tutorId = (st as any).tutor_id;
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}quizzes`)
      .select('*')
      .eq('tutor_id', tutorId)
      .eq('status', 'active')
      .or(`student_id.eq.${studentId},student_id.is.null`)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as Quiz[];
  }

  async getQuiz(id: string): Promise<Quiz | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}quizzes`)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? (snakeToCamel(data) as Quiz) : undefined;
  }

  async createQuiz(q: InsertQuiz): Promise<Quiz> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}quizzes`)
      .insert(camelToSnake(q))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as Quiz;
  }

  async updateQuiz(id: string, updates: Partial<InsertQuiz>): Promise<Quiz | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}quizzes`)
      .update(camelToSnake(updates))
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return undefined;
    return snakeToCamel(data) as Quiz;
  }

  async deleteQuiz(id: string): Promise<void> {
    const { error } = await supabase
      .from(`${TABLE_PREFIX}quizzes`)
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async createQuizAttempt(a: InsertQuizAttempt): Promise<QuizAttempt> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}quiz_attempts`)
      .insert(camelToSnake(a))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as QuizAttempt;
  }

  async getQuizAttemptsByQuiz(quizId: string): Promise<QuizAttempt[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}quiz_attempts`)
      .select('*')
      .eq('quiz_id', quizId)
      .order('started_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as QuizAttempt[];
  }

  async getQuizAttemptsByStudent(studentId: string, limit = 50): Promise<QuizAttempt[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}quiz_attempts`)
      .select('*')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as QuizAttempt[];
  }

  async getQuizAttemptsByTutor(tutorId: string, limit = 100): Promise<QuizAttempt[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}quiz_attempts`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as QuizAttempt[];
  }

  // ===== Lesson Recordings =====
  async createLessonRecording(r: InsertLessonRecording): Promise<LessonRecording> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}lesson_recordings`)
      .insert(camelToSnake(r))
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data) as LessonRecording;
  }
  async getLessonRecording(id: string): Promise<LessonRecording | undefined> {
    const { data } = await supabase.from(`${TABLE_PREFIX}lesson_recordings`).select('*').eq('id', id).maybeSingle();
    return data ? (snakeToCamel(data) as LessonRecording) : undefined;
  }
  async getLessonRecordingsByTutor(tutorId: string, limit = 100): Promise<LessonRecording[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}lesson_recordings`)
      .select('*')
      .eq('tutor_id', tutorId)
      .order('recorded_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as LessonRecording[];
  }
  async getLessonRecordingsByStudent(studentId: string, limit = 100): Promise<LessonRecording[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}lesson_recordings`)
      .select('*')
      .eq('student_id', studentId)
      .eq('status', 'ready')
      .order('recorded_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel) as LessonRecording[];
  }
  async getLessonRecordingByBbbRecordId(bbbRecordId: string): Promise<LessonRecording | undefined> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}lesson_recordings`)
      .select('*')
      .eq('bbb_record_id', bbbRecordId)
      .maybeSingle();
    return data ? (snakeToCamel(data) as LessonRecording) : undefined;
  }
  async updateLessonRecording(id: string, updates: Partial<InsertLessonRecording>): Promise<LessonRecording | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}lesson_recordings`)
      .update(camelToSnake(updates))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? (snakeToCamel(data) as LessonRecording) : undefined;
  }
  async deleteLessonRecording(id: string): Promise<void> {
    await supabase.from(`${TABLE_PREFIX}lesson_recordings`).delete().eq('id', id);
  }

  // ────────── Promo codes ──────────
  async listPromoCodes(): Promise<any[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}promo_codes`)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(snakeToCamel);
  }
  async getPromoCodeById(id: string): Promise<any | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}promo_codes`)
      .select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? snakeToCamel(data) : undefined;
  }
  async getPromoCodeByCode(code: string): Promise<any | undefined> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}promo_codes`)
      .select('*').eq('code', code.trim().toUpperCase()).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? snakeToCamel(data) : undefined;
  }
  async createPromoCode(input: any): Promise<any> {
    const payload: any = {
      code: String(input.code).trim().toUpperCase(),
      description: input.description ?? null,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      scope: input.scope ?? 'all',
      max_uses: input.maxUses ?? null,
      valid_from: input.validFrom ?? null,
      valid_until: input.validUntil ?? null,
      is_active: input.isActive ?? true,
      created_by: input.createdBy ?? null,
    };
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}promo_codes`)
      .insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data);
  }
  async updatePromoCode(id: string, patch: any): Promise<any | undefined> {
    const payload: any = {};
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.discountType !== undefined) payload.discount_type = patch.discountType;
    if (patch.discountValue !== undefined) payload.discount_value = patch.discountValue;
    if (patch.scope !== undefined) payload.scope = patch.scope;
    if (patch.maxUses !== undefined) payload.max_uses = patch.maxUses;
    if (patch.validFrom !== undefined) payload.valid_from = patch.validFrom;
    if (patch.validUntil !== undefined) payload.valid_until = patch.validUntil;
    if (patch.isActive !== undefined) payload.is_active = patch.isActive;
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}promo_codes`)
      .update(payload).eq('id', id).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    return data ? snakeToCamel(data) : undefined;
  }
  async deletePromoCode(id: string): Promise<void> {
    const { error } = await supabase.from(`${TABLE_PREFIX}promo_codes`).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
  async incrementPromoCodeUse(id: string): Promise<void> {
    const baseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, "");
    const key = process.env.SUPABASE_SERVICE_KEY || '';
    const escaped = String(id).replace(/'/g, "''");
    await fetch(`${baseUrl}/pg/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        query: `UPDATE "${TABLE_PREFIX}promo_codes" SET used_count = used_count + 1 WHERE id = '${escaped}'`,
      }),
    });
  }
  async tryMarkWebhookEventProcessed(eventId: string, source: string = 'yookassa'): Promise<boolean> {
    const baseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, "");
    const key = process.env.SUPABASE_SERVICE_KEY || '';
    const ev = String(eventId).replace(/'/g, "''");
    const src = String(source).replace(/'/g, "''");
    try {
      const res = await fetch(`${baseUrl}/pg/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          query: `INSERT INTO "${TABLE_PREFIX}processed_webhook_events" (event_id, source) VALUES ('${ev}', '${src}') ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
        }),
      });
      if (!res.ok) return true; // fail-open, не блокируем обработку
      const txt = await res.text();
      try {
        const json = JSON.parse(txt);
        if (Array.isArray(json) && json.length === 0) return false;
        return true;
      } catch { return true; }
    } catch { return true; }
  }
  async createPromoRedemption(input: any): Promise<any> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}promo_code_redemptions`)
      .insert({
        promo_code_id: input.promoCodeId,
        user_id: input.userId,
        user_role: input.userRole,
        scope: input.scope,
        original_amount: input.originalAmount,
        discount_amount: input.discountAmount,
        final_amount: input.finalAmount,
        reference_id: input.referenceId ?? null,
      }).select('*').single();
    if (error) throw new Error(error.message);
    return snakeToCamel(data);
  }
  async hasUserRedeemed(promoCodeId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from(`${TABLE_PREFIX}promo_code_redemptions`)
      .select('id').eq('promo_code_id', promoCodeId).eq('user_id', userId).limit(1);
    return !!(data && data.length);
  }

  async updateParentReportSchedule(studentId: string, schedule: 'off' | 'weekly' | 'monthly'): Promise<void> {
    await supabase.from(`${TABLE_PREFIX}students`)
      .update({ parent_report_schedule: schedule })
      .eq('id', studentId);
  }
  async getStudentsForParentReport(): Promise<any[]> {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}students`)
      .select('*')
      .neq('parent_report_schedule', 'off')
      .eq('is_active', true);
    if (error) return [];
    return (data || []).map(snakeToCamel);
  }
  async markParentReportSent(studentId: string): Promise<void> {
    await supabase.from(`${TABLE_PREFIX}students`)
      .update({ parent_report_last_sent_at: new Date().toISOString() })
      .eq('id', studentId);
  }
}

export const storage = new SupabaseStorage();
