import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Sidebar from '../components/Sidebar';
import profileStyles from '../styles/profile.module.css';
import eventStyles from '../styles/event.module.css';
import { FaCloud, FaDollarSign, FaMoon, FaSignOutAlt, FaSun, FaTrashAlt, FaUserEdit } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';

const fallbackUser = {
  full_name: 'Skies User',
  email: 'traveler@example.com',
  travel_preferences: {
    environment: 'Both',
    pace: 'Relaxed',
    budget: 1500,
    email_updates: true
  },
  saved_locations: [
    { id: '1', name: 'Fort San Pedro', type: 'Historical' },
    { id: '2', name: 'Cebu Ocean Park', type: 'Attraction' }
  ],
  saved_itineraries: [
    { id: '1', name: 'Cebu South Trip', date: 'March 4-7, 2026' },
    { id: '2', name: 'City Tour', date: 'April 10, 2026' }
  ],
  analytics: {
    trips_taken: 5,
    places_visited: 24,
    most_visited: 'Cebu City'
  }
};

const THEME_STORAGE_KEY = 'schedule-skies-theme';

const OptionSelect = ({ label, options, selected, onSelect }) => (
  <div className={profileStyles.option_group}>
    <span className={profileStyles.option_label}>{label}</span>
    <div className={profileStyles.options_container}>
      {options.map(opt => (
        <button 
          type="button"
          key={opt}
          className={`${profileStyles.option_btn} ${selected === opt ? profileStyles.option_active : ''}`}
          onClick={() => onSelect(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
);

const ProfilePage = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Preferences');
  const [userData, setUserData] = useState(fallbackUser);
  const [authUserId, setAuthUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [themeMode, setThemeMode] = useState('light');

  const [fullName, setFullName] = useState('');
  const [budget, setBudget] = useState(2);
  const [environment, setEnvironment] = useState('Both');
  const [pace, setPace] = useState('Relaxed');
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);

  const showMessage = (type, value) => {
    setMessageType(type);
    setMessage(value);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setThemeMode(savedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: authData, error: userError } = await supabase.auth.getUser();
        const authUser = authData?.user;

        if (userError || !authUser) {
          router.push('/login');
          return;
        }

        setAuthUserId(authUser.id);

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        const resolvedName =
          profile?.full_name ||
          authUser.user_metadata?.full_name ||
          authUser.email?.split('@')[0] ||
          'User';

        const mergedUser = {
          ...fallbackUser,
          ...profile,
          full_name: resolvedName,
          email: authUser.email || fallbackUser.email
        };

        setUserData(mergedUser);
        setFullName(mergedUser.full_name);
        if (mergedUser.travel_preferences) {
          const loadedBudget = mergedUser.travel_preferences.budget;
          let newBudgetLevel = 2;
          if (loadedBudget) {
            if (loadedBudget <= 5) newBudgetLevel = loadedBudget;
            else if (loadedBudget < 500) newBudgetLevel = 1;
            else if (loadedBudget < 1000) newBudgetLevel = 2;
            else if (loadedBudget < 2000) newBudgetLevel = 3;
            else if (loadedBudget < 5000) newBudgetLevel = 4;
            else newBudgetLevel = 5;
          }
          setBudget(newBudgetLevel);
          setEnvironment(mergedUser.travel_preferences.environment || 'Both');
          setPace(mergedUser.travel_preferences.pace || 'Relaxed');
          setEmailUpdates(
            typeof mergedUser.travel_preferences.email_updates === 'boolean'
              ? mergedUser.travel_preferences.email_updates
              : true
          );
        }
      } catch (err) {
        console.log('Fetching user data failed, using fallback:', err.message);
        setUserData(fallbackUser);
        setFullName(fallbackUser.full_name);
        setBudget(3);
        setEnvironment(fallbackUser.travel_preferences.environment);
        setPace(fallbackUser.travel_preferences.pace);
        setEmailUpdates(fallbackUser.travel_preferences.email_updates);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const profileStats = useMemo(() => {
    const itineraries = userData?.saved_itineraries?.length || 0;
    const locations = userData?.saved_locations?.length || 0;
    return { itineraries, locations };
  }, [userData]);

  const handleSaveProfile = async () => {
    if (!authUserId) return;

    setSaving(true);
    setMessage('');

    const payload = {
      id: authUserId,
      full_name: fullName.trim(),
      travel_preferences: {
        budget: Number(budget),
        environment,
        pace,
        email_updates: emailUpdates
      },
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('profiles').upsert(payload);
    setSaving(false);

    if (error) {
      showMessage('error', `Unable to save profile: ${error.message}`);
      return;
    }

    setUserData((prev) => ({ ...prev, ...payload }));
    showMessage('success', 'Profile preferences saved.');
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showMessage('error', 'Password must be at least 6 characters.');
      return;
    }

    setSecurityLoading(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSecurityLoading(false);

    if (error) {
      showMessage('error', `Password update failed: ${error.message}`);
      return;
    }

    setNewPassword('');
    showMessage('success', 'Password updated successfully.');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.prompt('Type DELETE to permanently remove your account.');
    if (confirmDelete !== 'DELETE') return;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      showMessage('error', 'Session expired. Please log in again.');
      return;
    }

    setSecurityLoading(true);
    setMessage('');

    const response = await fetch('/api/delete-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    const result = await response.json();
    setSecurityLoading(false);

    if (!response.ok) {
      showMessage('error', result?.error || 'Failed to delete account.');
      return;
    }

    await supabase.auth.signOut();
    router.push('/signup');
  };

  if (loading) {
    return (
      <div className={profileStyles.loadingScreen}>
        Loading profile...
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Account Profile</title>
      </Head>
      <div className={eventStyles.appContainer}>
        <Sidebar />
        <main className={eventStyles.mainContent} style={{ padding: 0 }}>
          {/* Sky Decorations */}
          <div className={eventStyles.sun}></div>
          <div className={`${eventStyles.cloud} ${eventStyles.cloud1}`}></div>
          <div className={`${eventStyles.cloud} ${eventStyles.cloud2}`}></div>

          <header className={profileStyles.profile_header} style={{ marginLeft: 0, borderRadius: '0 0 30px 30px', marginBottom: '30px', position: 'relative', zIndex: 10, minHeight: '320px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div className={profileStyles.profile_picture} style={{ width: '120px', height: '120px', fontSize: '3rem', margin: '0 0 20px 0', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
              {(fullName || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h1 style={{ fontSize: '3.5rem', fontWeight: '800', marginBottom: '10px', textShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>{fullName || 'GUEST'}</h1>
              <span style={{ fontSize: '1.2rem', opacity: 0.9, color: '#fff', backgroundColor: 'rgba(0,0,0,0.2)', padding: '5px 15px', borderRadius: '20px' }}>{userData?.email}</span>
              
              <div className={profileStyles.quickStats} style={{ marginTop: '20px' }}>
                <span style={{ fontSize: '1rem', padding: '8px 20px', background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>{profileStats.itineraries} itineraries</span>
                <span style={{ fontSize: '1rem', padding: '8px 20px', background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>{profileStats.locations} saved places</span>
              </div>
            </div>
          </header>

          <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', padding: '0 60px 40px 60px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px', width: '100%' }}>
              <div className={eventStyles.actionGroup} style={{ margin: 0, gap: '15px' }}>
                <button 
                  className={`${eventStyles.actionBtn} ${activeTab === 'Preferences' ? eventStyles.activeEditBtn : ''}`}
                  onClick={() => setActiveTab('Preferences')}
                  style={{ fontSize: '16px', padding: '10px 25px' }}
                >
                  Preferences
                </button>
                <button 
                  className={`${eventStyles.actionBtn} ${activeTab === 'Itineraries' ? eventStyles.activeEditBtn : ''}`}
                  onClick={() => setActiveTab('Itineraries')}
                  style={{ fontSize: '16px', padding: '10px 25px' }}
                >
                  Itineraries & Locations
                </button>
                <button 
                  className={`${eventStyles.actionBtn} ${activeTab === 'Analytics' ? eventStyles.activeEditBtn : ''}`}
                  onClick={() => setActiveTab('Analytics')}
                  style={{ fontSize: '16px', padding: '10px 25px' }}
                >
                  Analytics
                </button>
                <button 
                  className={`${eventStyles.actionBtn} ${activeTab === 'Account' ? eventStyles.activeEditBtn : ''}`}
                  onClick={() => setActiveTab('Account')}
                  style={{ fontSize: '16px', padding: '10px 25px' }}
                >
                  Account
                </button>
              </div>
            </div>
            {message ? (
              <div className={`${profileStyles.message} ${messageType === 'error' ? profileStyles.error : profileStyles.success}`}>
                {message}
              </div>
            ) : null}

            {activeTab === 'Preferences' && (
              <>
                <section style={{ display: 'flex', gap: '20px', flex: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div className={eventStyles.eventCard} style={{ flex: '1 1 400px', padding: '30px' }}>
                    <div style={{ width: '100%' }}>
                      <h3 style={{ color: '#2C3E50', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}><FaUserEdit /> Profile</h3>
                      <div className={profileStyles.option_group}>
                        <span className={profileStyles.option_label}>Display Name</span>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className={profileStyles.profileInput}
                          placeholder="Your name"
                        />
                      </div>
                      <h3 style={{ color: '#2C3E50', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '30px', marginBottom: '20px' }}><FaCloud /> Travel Style</h3>
                      <OptionSelect 
                        label="Environment"
                        options={['Indoor', 'Outdoor', 'Both']}
                        selected={environment}
                        onSelect={setEnvironment}
                      />
                      <OptionSelect 
                        label="Pace"
                        options={['Relaxed', 'Moderate', 'Fast-paced']}
                        selected={pace}
                        onSelect={setPace}
                      />
                    </div>
                  </div>

                  <div className={eventStyles.eventCard} style={{ flex: '1 1 400px', padding: '30px' }}>
                    <div style={{ width: '100%' }}>
                      <h3 style={{ color: '#2C3E50', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}><FaDollarSign /> Budget Level</h3>
                      <div className={profileStyles.options_container}>
                        {[1, 2, 3, 4, 5].map(level => (
                          <button
                            type="button"
                            key={level}
                            className={`${profileStyles.option_btn} ${budget === level ? profileStyles.option_active : ''}`}
                            onClick={() => setBudget(level)}
                            style={{ fontSize: '18px', padding: '10px 15px', flex: '1', minWidth: '40px' }}
                          >
                            {'$'.repeat(level)}
                          </button>
                        ))}
                      </div>
                      <div style={{ marginTop: '15px', fontSize: '15px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: '600' }}>
                        {budget === 1 && "Budget-friendly ($)"}
                        {budget === 2 && "Affordable ($$)"}
                        {budget === 3 && "Moderate ($$$)"}
                        {budget === 4 && "Premium ($$$$)"}
                        {budget === 5 && "Luxury ($$$$$)"}
                      </div>
                    </div>
                  </div>
                </section>
                <div className={profileStyles.settings_button_container}>
                  <button className={profileStyles.settings_button} type="button" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Preferences'}
                  </button>
                  <button 
                    className={profileStyles.settings_button} 
                    type="button" 
                    onClick={handleLogout}
                    style={{ background: 'transparent', color: '#e74c3c', border: '2px solid #e74c3c', boxShadow: 'none' }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#e74c3c'; e.currentTarget.style.color = '#fff'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#e74c3c'; }}
                  >
                    <FaSignOutAlt /> Log Out
                  </button>
                </div>
              </>
            )}
            
            {activeTab === 'Itineraries' && (
              <section style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div className={eventStyles.eventCard} style={{ flex: '1 1 400px', padding: '30px' }}>
                  <div style={{ width: '100%' }}>
                    <h3 style={{ color: '#2C3E50', fontSize: '18px', marginBottom: '20px' }}>Saved Itineraries</h3>
                    <div className={profileStyles.list_container}>
                      {userData?.saved_itineraries?.map(itinerary => (
                        <div key={itinerary.id} className={profileStyles.list_item}>
                          <h4 style={{ margin: '0 0 4px' }}>{itinerary.name}</h4>
                          <span className={profileStyles.meta_text}>{itinerary.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={eventStyles.eventCard} style={{ flex: '1 1 400px', padding: '30px' }}>
                  <div style={{ width: '100%' }}>
                    <h3 style={{ color: '#2C3E50', fontSize: '18px', marginBottom: '20px' }}>Favorite Locations</h3>
                    <div className={profileStyles.list_container}>
                      {userData?.saved_locations?.map(location => (
                        <div key={location.id} className={profileStyles.list_item}>
                          <h4 style={{ margin: '0 0 4px' }}>{location.name}</h4>
                          <span className={profileStyles.meta_text}>{location.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'Analytics' && (
              <section style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div className={eventStyles.eventCard} style={{ flex: '1 1 400px', padding: '30px' }}>
                  <div style={{ width: '100%' }}>
                    <h3 style={{ color: '#2C3E50', fontSize: '18px', marginBottom: '20px' }}>Travel Analytics</h3>
                    <div className={profileStyles.analytics_grid}>
                      <div className={profileStyles.stat_box}>
                        <span className={profileStyles.stat_value}>{userData?.analytics?.trips_taken || 0}</span>
                        <span className={profileStyles.stat_label}>Trips Taken</span>
                      </div>
                      <div className={profileStyles.stat_box}>
                        <span className={profileStyles.stat_value}>{userData?.analytics?.places_visited || 0}</span>
                        <span className={profileStyles.stat_label}>Places Visited</span>
                      </div>
                      <div className={profileStyles.stat_box}>
                        <span className={profileStyles.stat_value_text}>{userData?.analytics?.most_visited || 'N/A'}</span>
                        <span className={profileStyles.stat_label}>Most Visited City</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'Account' && (
              <section style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div className={eventStyles.eventCard} style={{ flex: '1 1 400px', padding: '30px' }}>
                  <div style={{ width: '100%' }}>
                    <h3 style={{ color: '#2C3E50', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>{themeMode === 'dark' ? <FaMoon /> : <FaSun />} Theme</h3>
                    <div className={profileStyles.segmented}>
                      <button
                        type="button"
                        className={`${profileStyles.segmentBtn} ${themeMode === 'light' ? profileStyles.segmentBtnActive : ''}`}
                        onClick={() => setThemeMode('light')}
                      >
                        Light Mode
                      </button>
                      <button
                        type="button"
                        className={`${profileStyles.segmentBtn} ${themeMode === 'dark' ? profileStyles.segmentBtnActive : ''}`}
                        onClick={() => setThemeMode('dark')}
                      >
                        Dark Mode
                      </button>
                    </div>
                    <div className={profileStyles.toggle_item} style={{ marginTop: '30px' }}>
                      <span style={{ fontWeight: 600, color: '#2C3E50' }}>Email updates</span>
                      <label className={profileStyles.toggle_switch}>
                        <input
                          type="checkbox"
                          checked={emailUpdates}
                          onChange={(e) => setEmailUpdates(e.target.checked)}
                        />
                        <span className={profileStyles.slider}></span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className={eventStyles.eventCard} style={{ flex: '1 1 400px', padding: '30px' }}>
                  <div style={{ width: '100%' }}>
                    <h3 style={{ color: '#2C3E50', fontSize: '18px', marginBottom: '20px' }}>Security</h3>
                    <div className={profileStyles.option_group}>
                      <span className={profileStyles.option_label}>New Password</span>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={profileStyles.profileInput}
                        placeholder="At least 6 characters"
                      />
                    </div>
                    <div className={profileStyles.actionGroup} style={{ marginTop: '30px' }}>
                      <button type="button" className={profileStyles.secondaryBtn} onClick={handleChangePassword} disabled={securityLoading}>
                        Update Password
                      </button>
                      <button type="button" className={profileStyles.secondaryBtn} onClick={handleLogout}>
                        <FaSignOutAlt /> Log Out
                      </button>
                      <button type="button" className={profileStyles.dangerBtn} onClick={handleDeleteAccount} disabled={securityLoading}>
                        <FaTrashAlt /> Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default ProfilePage;
