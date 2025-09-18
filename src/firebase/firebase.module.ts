import { Module, Global } from '@nestjs/common';
import * as admin from 'firebase-admin';

export const FIREBASE_ADMIN = 'FIREBASE_ADMIN';
export const FIRESTORE = 'FIRESTORE';

@Global()
@Module({
  providers: [
    {
      provide: FIREBASE_ADMIN,
      useFactory: () => {
        if (!admin.apps.length) {
          // In a real app, load from config service
          // For now, relies on GOOGLE_APPLICATION_CREDENTIALS
          admin.initializeApp();
        }
        return admin;
      },
    },
    {
      provide: FIRESTORE,
      useFactory: (firebaseAdmin: typeof admin) => {
        return firebaseAdmin.firestore();
      },
      inject: [FIREBASE_ADMIN],
    },
  ],
  exports: [FIRESTORE],
})
export class FirebaseModule {}
