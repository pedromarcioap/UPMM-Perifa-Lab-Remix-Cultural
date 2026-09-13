import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { User, PhotoBase, GraffitiSpot, Comment, WeeklyChallenge, RemixNotification, Badge } from './types';
import { 
  INITIAL_USERS, 
  INITIAL_PHOTOS, 
  INITIAL_GRAFFITI_SPOTS, 
  INITIAL_COMMENTS, 
  INITIAL_WEEKLY_CHALLENGES,
  BADGES
} from './constants';

// Initial Seeding to Firestore if collections are empty
export async function seedInitialFirestoreData() {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      console.log('Seeding initial users to Firestore...');
      for (const u of INITIAL_USERS) {
        await setDoc(doc(db, 'users', u.id), u).catch(() => {});
      }
    }
  } catch (_) {}

  try {
    const photosSnap = await getDocs(collection(db, 'photos'));
    if (photosSnap.empty) {
      console.log('Seeding initial photos to Firestore...');
      for (const p of INITIAL_PHOTOS) {
        await setDoc(doc(db, 'photos', p.id), p).catch(() => {});
      }
    }
  } catch (_) {}

  try {
    const spotsSnap = await getDocs(collection(db, 'graffitiSpots'));
    if (spotsSnap.empty) {
      console.log('Seeding initial graffiti spots to Firestore...');
      for (const s of INITIAL_GRAFFITI_SPOTS) {
        await setDoc(doc(db, 'graffitiSpots', s.id), s).catch(() => {});
      }
    }
  } catch (_) {}

  try {
    const commentsSnap = await getDocs(collection(db, 'comments'));
    if (commentsSnap.empty) {
      console.log('Seeding initial comments to Firestore...');
      for (const c of INITIAL_COMMENTS) {
        await setDoc(doc(db, 'comments', c.id), c).catch(() => {});
      }
    }
  } catch (_) {}

  try {
    const challengesSnap = await getDocs(collection(db, 'challenges'));
    if (challengesSnap.empty) {
      console.log('Seeding initial challenges to Firestore...');
      for (const ch of INITIAL_WEEKLY_CHALLENGES) {
        await setDoc(doc(db, 'challenges', ch.id), ch).catch(() => {});
      }
    }
  } catch (_) {}

  try {
    const badgesSnap = await getDocs(collection(db, 'badges'));
    if (badgesSnap.empty) {
      console.log('Seeding initial badges to Firestore...');
      for (const b of BADGES) {
        await setDoc(doc(db, 'badges', b.id), b).catch(() => {});
      }
    }
  } catch (_) {}
}

// Subscribe to real-time updates from Firestore
export function subscribeToFirestore(callbacks: {
  onUsers: (users: User[]) => void;
  onPhotos: (photos: PhotoBase[]) => void;
  onSpots: (spots: GraffitiSpot[]) => void;
  onComments: (comments: Comment[]) => void;
  onChallenges: (challenges: WeeklyChallenge[]) => void;
  onNotifications?: (notifications: RemixNotification[]) => void;
  onBadges?: (badges: Badge[]) => void;
}) {
  const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
    if (!snap.empty) {
      const items = snap.docs.map(d => d.data() as User);
      callbacks.onUsers(items);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'users');
  });

  const unsubPhotos = onSnapshot(collection(db, 'photos'), (snap) => {
    if (!snap.empty) {
      const items = snap.docs.map(d => d.data() as PhotoBase);
      callbacks.onPhotos(items);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'photos');
  });

  const unsubSpots = onSnapshot(collection(db, 'graffitiSpots'), (snap) => {
    if (!snap.empty) {
      const items = snap.docs.map(d => d.data() as GraffitiSpot);
      callbacks.onSpots(items);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'graffitiSpots');
  });

  const unsubComments = onSnapshot(collection(db, 'comments'), (snap) => {
    if (!snap.empty) {
      const items = snap.docs.map(d => d.data() as Comment);
      // Sort newest first
      items.sort((a, b) => b.createdAt - a.createdAt);
      callbacks.onComments(items);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'comments');
  });

  const unsubChallenges = onSnapshot(collection(db, 'challenges'), (snap) => {
    if (!snap.empty) {
      const items = snap.docs.map(d => d.data() as WeeklyChallenge);
      callbacks.onChallenges(items);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'challenges');
  });

  const unsubNotifications = callbacks.onNotifications 
    ? onSnapshot(collection(db, 'notifications'), (snap) => {
        if (!snap.empty) {
          const items = snap.docs.map(d => d.data() as RemixNotification);
          items.sort((a, b) => b.createdAt - a.createdAt);
          callbacks.onNotifications?.(items);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'notifications');
      })
    : () => {};

  const unsubBadges = callbacks.onBadges
    ? onSnapshot(collection(db, 'badges'), (snap) => {
        if (!snap.empty) {
          const items = snap.docs.map(d => d.data() as Badge);
          callbacks.onBadges?.(items);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'badges');
      })
    : () => {};

  return () => {
    unsubUsers();
    unsubPhotos();
    unsubSpots();
    unsubComments();
    unsubChallenges();
    unsubNotifications();
    unsubBadges();
  };
}

// Data Mutation Operations
export async function persistUser(user: User) {
  try {
    await setDoc(doc(db, 'users', user.id), user, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
  }
}

export async function persistPhoto(photo: PhotoBase) {
  try {
    await setDoc(doc(db, 'photos', photo.id), photo);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `photos/${photo.id}`);
  }
}

export async function updatePhotoInFirestore(photoId: string, updates: Partial<PhotoBase>) {
  try {
    await updateDoc(doc(db, 'photos', photoId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `photos/${photoId}`);
  }
}

export async function deletePhotoFromFirestore(photoId: string) {
  try {
    await deleteDoc(doc(db, 'photos', photoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `photos/${photoId}`);
  }
}

export async function persistComment(comment: Comment) {
  try {
    await setDoc(doc(db, 'comments', comment.id), comment);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `comments/${comment.id}`);
  }
}

export async function persistSpot(spot: GraffitiSpot) {
  try {
    await setDoc(doc(db, 'graffitiSpots', spot.id), spot);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `graffitiSpots/${spot.id}`);
  }
}

export async function deleteSpotFromFirestore(spotId: string) {
  try {
    await deleteDoc(doc(db, 'graffitiSpots', spotId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `graffitiSpots/${spotId}`);
  }
}

export async function persistChallenge(challenge: WeeklyChallenge) {
  try {
    await setDoc(doc(db, 'challenges', challenge.id), challenge, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `challenges/${challenge.id}`);
  }
}

export async function deleteChallengeFromFirestore(challengeId: string) {
  try {
    await deleteDoc(doc(db, 'challenges', challengeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `challenges/${challengeId}`);
  }
}

export async function persistNotification(notification: RemixNotification) {
  try {
    await setDoc(doc(db, 'notifications', notification.id), notification);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `notifications/${notification.id}`);
  }
}

export async function updateNotificationInFirestore(notificationId: string, updates: Partial<RemixNotification>) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function persistBadge(badge: Badge) {
  try {
    await setDoc(doc(db, 'badges', badge.id), badge, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `badges/${badge.id}`);
  }
}

export async function deleteBadgeFromFirestore(badgeId: string) {
  try {
    await deleteDoc(doc(db, 'badges', badgeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `badges/${badgeId}`);
  }
}

