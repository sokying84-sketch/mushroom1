import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { Leaf, Package, BarChart3, Users, ShieldCheck, Mail, Lock, User, Upload, ArrowRight, LogOut, Loader2, Settings, Trash2, Camera, X } from 'lucide-react';
import { auth, db } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut, deleteUser, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

interface UserProfile {
  name: string;
  email: string;
  photoFileName: string;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  // Auth State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Edit Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);

  // Monitor Auth Status & Fetch Profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await fetchAndSyncUserProfile(user);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchAndSyncUserProfile = async (user: FirebaseUser) => {
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        // Sync: User exists in Auth but not in Firestore (e.g. legacy or console created)
        const newProfile = {
           name: user.displayName || 'User',
           email: user.email || '',
           photoFileName: user.photoURL || 'default-avatar.png' 
        };
        await setDoc(docRef, newProfile);
        setUserProfile(newProfile);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  const handleFirebaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Profile sync handled in onAuthStateChanged
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErrorMsg("password or email incorrect");
      } else {
        setErrorMsg(error.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFirebaseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password !== repeatPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    setIsProcessing(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const fileName = photoFile ? photoFile.name : 'default-avatar.png';

      // 1. Update Auth Profile
      await updateProfile(user, { 
        displayName: displayName || 'New User',
        photoURL: fileName 
      });

      // 2. Create Firestore Document
      await setDoc(doc(db, "users", user.uid), {
        name: displayName || 'New User',
        email: email,
        photoFileName: fileName
      });

    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
         setErrorMsg("user already exist, sign in?");
      } else {
         setErrorMsg(error.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    
    setIsProcessing(true);
    try {
       const newFileName = editPhotoFile ? editPhotoFile.name : userProfile?.photoFileName || 'default-avatar.png';
       
       // Update Firestore
       await updateDoc(doc(db, "users", firebaseUser.uid), {
         name: editName,
         photoFileName: newFileName
       });

       // Update Auth
       await updateProfile(firebaseUser, {
         displayName: editName,
         photoURL: newFileName
       });

       // Update Local State
       setUserProfile(prev => prev ? { ...prev, name: editName, photoFileName: newFileName } : null);
       setShowProfileModal(false);
    } catch (error: any) {
       console.error("Update failed", error);
       alert("Failed to update profile: " + error.message);
    } finally {
       setIsProcessing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!firebaseUser) return;
    const confirm = window.confirm("Are you sure you want to delete your account? This cannot be undone.");
    if (!confirm) return;

    setIsProcessing(true);
    try {
      // 1. Delete Firestore Doc
      await deleteDoc(doc(db, "users", firebaseUser.uid));
      
      // 2. Delete Auth User
      await deleteUser(firebaseUser);
      
      // Auth state change will handle redirect to login
    } catch (error: any) {
      console.error("Delete failed", error);
      alert("Failed to delete account (Requires recent login): " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setAuthMode('signin');
    setUserProfile(null);
  };

  const openProfileModal = () => {
    if (userProfile) {
      setEditName(userProfile.name);
      setEditPhotoFile(null); // Reset file input
      setShowProfileModal(true);
    }
  };

  // --------------------------------------------------------------------------------
  // LOADING STATE
  // --------------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-earth-900 text-white">
        <Loader2 size={48} className="animate-spin text-nature-500" />
      </div>
    );
  }

  // --------------------------------------------------------------------------------
  // AUTHENTICATED STATE: SHOW ROLE SELECTION & PROFILE
  // --------------------------------------------------------------------------------
  if (firebaseUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-earth-900 via-earth-800 to-earth-900 relative overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
           <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-nature-800 blur-3xl"></div>
           <div className="absolute top-[40%] right-[10%] w-[30%] h-[30%] rounded-full bg-earth-600 blur-3xl"></div>
        </div>

        <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-md w-full border-2 border-earth-200 z-10 relative animate-in fade-in zoom-in-95 duration-300">
          <div className="text-center mb-6 relative">
            <button 
              onClick={openProfileModal}
              className="absolute right-0 top-0 p-2 text-earth-400 hover:text-earth-600 hover:bg-earth-50 rounded-full transition-colors"
              title="Manage Profile"
            >
              <Settings size={20} />
            </button>

            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-nature-100 text-nature-700 mb-4 shadow-inner border-4 border-white relative">
              <Leaf size={32} />
              {/* Simulate User Photo if we had real storage, for now displaying icon but referencing filename in tooltip */}
              {userProfile?.photoFileName && userProfile.photoFileName !== 'default-avatar.png' && (
                  <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 border-2 border-white rounded-full flex items-center justify-center text-white" title={userProfile.photoFileName}>
                      <Camera size={12} />
                  </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-earth-900">{userProfile?.name || firebaseUser.displayName}</h1>
            <p className="text-earth-600 text-sm">{userProfile?.email || firebaseUser.email}</p>
            {userProfile?.photoFileName && (
               <p className="text-xs text-slate-400 mt-1 truncate max-w-[200px] mx-auto">IMG: {userProfile.photoFileName}</p>
            )}
          </div>

          <p className="text-center text-earth-500 text-sm mb-4 font-medium border-b border-earth-100 pb-4">Select Workspace</p>

          <div className="space-y-3">
            <button
              onClick={() => onLogin(UserRole.ADMIN)}
              className="w-full flex items-center p-3 rounded-xl border border-earth-300 bg-earth-50 hover:border-earth-500 hover:bg-white transition-all group"
            >
              <div className="p-2 bg-earth-200 rounded-lg group-hover:bg-earth-800 group-hover:text-white text-earth-800 transition-colors">
                <ShieldCheck size={20} />
              </div>
              <div className="ml-4 text-left">
                <h3 className="font-semibold text-earth-900">Operations Manager</h3>
                <p className="text-xs text-earth-500">Full Access Dashboard</p>
              </div>
            </button>

            <button
              onClick={() => onLogin(UserRole.PROCESSING_WORKER)}
              className="w-full flex items-center p-3 rounded-xl border border-earth-200 hover:border-nature-500 hover:bg-nature-50 transition-all group"
            >
              <div className="p-2 bg-earth-100 rounded-lg group-hover:bg-nature-100 text-earth-700 group-hover:text-nature-700 transition-colors">
                <Users size={20} />
              </div>
              <div className="ml-4 text-left">
                <h3 className="font-semibold text-earth-900">Processing Worker</h3>
                <p className="text-xs text-earth-500">Log deliveries, wash & dry</p>
              </div>
            </button>

            <button
              onClick={() => onLogin(UserRole.PACKING_STAFF)}
              className="w-full flex items-center p-3 rounded-xl border border-earth-200 hover:border-nature-500 hover:bg-nature-50 transition-all group"
            >
              <div className="p-2 bg-earth-100 rounded-lg group-hover:bg-nature-100 text-earth-700 group-hover:text-nature-700 transition-colors">
                <Package size={20} />
              </div>
              <div className="ml-4 text-left">
                <h3 className="font-semibold text-earth-900">Packing Staff</h3>
                <p className="text-xs text-earth-500">Label, QR scan, and store</p>
              </div>
            </button>

            <button
              onClick={() => onLogin(UserRole.FINANCE_CLERK)}
              className="w-full flex items-center p-3 rounded-xl border border-earth-200 hover:border-nature-500 hover:bg-nature-50 transition-all group"
            >
              <div className="p-2 bg-earth-100 rounded-lg group-hover:bg-nature-100 text-earth-700 group-hover:text-nature-700 transition-colors">
                <BarChart3 size={20} />
              </div>
              <div className="ml-4 text-left">
                <h3 className="font-semibold text-earth-900">Finance Clerk</h3>
                <p className="text-xs text-earth-500">Inventory & Financial Dashboard</p>
              </div>
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-earth-100 text-center">
            <button onClick={handleSignOut} className="text-sm text-red-500 hover:text-red-700 font-medium flex items-center justify-center mx-auto">
               <LogOut size={14} className="mr-1" /> Sign Out
            </button>
          </div>
        </div>

        {/* EDIT PROFILE MODAL */}
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-bold text-slate-900">Edit Profile</h3>
                   <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Display Name</label>
                      <input 
                         type="text" 
                         className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-earth-500" 
                         value={editName}
                         onChange={e => setEditName(e.target.value)}
                         required
                      />
                   </div>

                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Profile Photo</label>
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:bg-slate-50 relative">
                         <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setEditPhotoFile(e.target.files?.[0] || null)} />
                         <Camera className="mx-auto text-slate-400 mb-2" size={24} />
                         <span className="text-xs text-slate-500 font-medium">
                            {editPhotoFile ? editPhotoFile.name : (userProfile?.photoFileName || 'Click to change photo')}
                         </span>
                      </div>
                   </div>

                   <button 
                      type="submit" 
                      disabled={isProcessing}
                      className="w-full py-3 bg-earth-800 text-white font-bold rounded-lg hover:bg-earth-900 flex items-center justify-center"
                   >
                      {isProcessing ? <Loader2 className="animate-spin" /> : "Save Changes"}
                   </button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-100">
                    <button 
                      onClick={handleDeleteAccount}
                      disabled={isProcessing}
                      className="w-full py-3 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 font-bold rounded-lg flex items-center justify-center text-sm"
                    >
                       <Trash2 size={16} className="mr-2" /> Delete Account
                    </button>
                    <p className="text-[10px] text-red-400 text-center mt-2">Permanently deletes your account and data.</p>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------------
  // UNAUTHENTICATED STATE: LOGIN / REGISTER FORMS
  // --------------------------------------------------------------------------------
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-earth-900 to-slate-900 z-0"></div>
        <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-nature-900/20 blur-3xl z-0"></div>
        
        <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl z-10 mx-4">
           <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-slate-800 mb-1">ShroomTrack ERP</h1>
              <p className="text-slate-500 text-sm">Authentication Required</p>
           </div>

           {/* ERROR MESSAGE DISPLAY */}
           {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm font-bold flex items-center animate-pulse">
                  {errorMsg}
                  {errorMsg.includes('sign in?') && (
                      <button onClick={() => { setAuthMode('signin'); setErrorMsg(''); }} className="ml-auto underline text-red-800 hover:text-red-900">
                          Go to Sign In
                      </button>
                  )}
              </div>
           )}

           {authMode === 'signin' ? (
             /* --- LOGIN FORM --- */
             <form onSubmit={handleFirebaseLogin} className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                   <div className="relative">
                      <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input 
                        type="email" 
                        required
                        className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none transition-all" 
                        placeholder="you@company.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                   </div>
                </div>

                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                   <div className="relative">
                      <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input 
                        type="password" 
                        required
                        className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none transition-all" 
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                      />
                   </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isProcessing}
                  className="w-full py-3 bg-earth-800 text-white font-bold rounded-lg hover:bg-earth-900 shadow-lg flex items-center justify-center transition-all disabled:opacity-50"
                >
                   {isProcessing ? <Loader2 className="animate-spin" /> : "Sign In"}
                </button>

                <div className="text-center mt-4 text-sm text-slate-500">
                   Don't have an account? <button type="button" onClick={() => { setAuthMode('signup'); setErrorMsg(''); }} className="text-nature-600 font-bold hover:underline">Sign Up</button>
                </div>
             </form>
           ) : (
             /* --- REGISTER FORM --- */
             <form onSubmit={handleFirebaseRegister} className="space-y-4">
                <div className="flex justify-center mb-2">
                   <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 relative overflow-hidden group cursor-pointer hover:border-nature-500 hover:text-nature-500 hover:bg-nature-50 transition-all">
                       <Upload size={24} />
                       <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                       />
                       {photoFile && (
                         <div className="absolute inset-0 bg-nature-100 flex items-center justify-center text-nature-700 text-xs p-1 text-center font-bold">
                           {photoFile.name}
                         </div>
                       )}
                   </div>
                </div>
                <p className="text-center text-xs text-slate-400 mb-4">{photoFile ? 'Photo Selected' : 'Upload Profile Photo'}</p>

                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                   <div className="relative">
                      <User className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        required
                        className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-earth-500 outline-none" 
                        placeholder="John Doe"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                      />
                   </div>
                </div>

                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                   <div className="relative">
                      <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input 
                        type="email" 
                        required
                        className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-earth-500 outline-none" 
                        placeholder="you@company.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                       <input 
                         type="password" 
                         required
                         className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-earth-500 outline-none text-sm" 
                         placeholder="Create password"
                         value={password}
                         onChange={e => setPassword(e.target.value)}
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Repeat</label>
                       <input 
                         type="password" 
                         required
                         className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-earth-500 outline-none text-sm" 
                         placeholder="Confirm password"
                         value={repeatPassword}
                         onChange={e => setRepeatPassword(e.target.value)}
                       />
                    </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isProcessing}
                  className="w-full py-3 bg-nature-600 text-white font-bold rounded-lg hover:bg-nature-700 shadow-lg flex items-center justify-center transition-all disabled:opacity-50 mt-4"
                >
                   {isProcessing ? <Loader2 className="animate-spin" /> : "Register Account"}
                </button>

                <div className="text-center mt-4 text-sm text-slate-500">
                   Already have an account? <button type="button" onClick={() => { setAuthMode('signin'); setErrorMsg(''); }} className="text-earth-700 font-bold hover:underline">Sign In</button>
                </div>
             </form>
           )}
        </div>
    </div>
  );
};

export default Login;