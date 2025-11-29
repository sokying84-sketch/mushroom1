import { storage, db } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { UserFile, ApiResponse } from '../types';

export const uploadUserFile = async (file: File, uid: string): Promise<ApiResponse<UserFile>> => {
  try {
    // 1. Upload to Firebase Storage
    // Path: user_uploads/{uid}/{filename}
    const storagePath = `user_uploads/${uid}/${file.name}`;
    const storageRef = ref(storage, storagePath);
    
    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);

    // 2. Save Metadata to Firestore
    // Path: users/{uid}/files/{docId}
    const fileData = {
      name: file.name,
      size: file.size,
      type: file.type,
      downloadUrl: downloadUrl,
      storagePath: storagePath,
      uploadDate: new Date().toISOString(),
      createdAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, "users", uid, "files"), fileData);

    return {
      success: true,
      data: {
        id: docRef.id,
        ...fileData
      }
    };
  } catch (error: any) {
    console.error("Upload failed:", error);
    return { success: false, message: error.message };
  }
};

export const deleteUserFile = async (fileId: string, storagePath: string, uid: string): Promise<ApiResponse<boolean>> => {
  try {
    // 1. Delete from Storage
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);

    // 2. Delete from Firestore
    await deleteDoc(doc(db, "users", uid, "files", fileId));

    return { success: true, message: "File deleted successfully" };
  } catch (error: any) {
    console.error("Delete failed:", error);
    return { success: false, message: error.message };
  }
};

export const getUserFiles = async (uid: string): Promise<ApiResponse<UserFile[]>> => {
  try {
    const q = query(collection(db, "users", uid, "files"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    const files: UserFile[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      files.push({
        id: doc.id,
        name: data.name,
        size: data.size,
        type: data.type,
        downloadUrl: data.downloadUrl,
        storagePath: data.storagePath,
        uploadDate: data.uploadDate
      });
    });

    return { success: true, data: files };
  } catch (error: any) {
    console.error("Fetch files failed:", error);
    return { success: false, message: error.message };
  }
};
