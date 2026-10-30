"""
Django settings for the PAC University Thesis Tracking System

Configuration Strategy
----------------------
* All secrets and the database URLs come from environment variables
  (loaded from backend/.env via python-dotenv)
* The database is Neon Postgres. Two URLs are used:
    - DATABASE_URL polled -> normal runtime queries
    - DIRECT_URL direct -> migrations only
  Neon's connection pooler does not support all session-level operations, 
  which is why migrations bypass it.
* `CONN_MAX_AGE=0` is deliberate: Neon suspends idle compute after ~5min,
so we never want tDjango to reuse a stale connection.
"""

from pathlib import Path
import os
import sys

import dj_database_url
from dotenv import load_dotenv

#--------------------------------------------------------------
# Paths and environment
#--------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR/ ".env")


#-------------------------------------------------------------
# Security
#-------------------------------------------------------------

SECRET_KEY = os.environ["SECRET_KEY"]                     #fail fast if missing

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv("DEBUG", "False").lower() =="true"

ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

#-------------------------------------------------------------
# Application 
#---------------------------------------------------------------

INSTALLED_APPS = [
    # Django built-ins
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # third party
    'rest_framework',
    'corsheaders',
    
    #local
    'api',
]

#-----------------------------------------------------------------
#  Middleware
#-----------------------------------------------------------------
# CorsMiddleware must sit as high as possible(before CommonMiddleware)
# so preflight requests are answered before hitting view logic.

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


#-------------------------------------------------------------
# Database
# ------------------------------------------------------------

DATABASES = {
    'default': dj_database_url.parse(
        os.environ["DATABASE_URL"],
        conn_max_age=0,
        conn_health_checks=True,
        ssl_require=True,
    )
}

# migrations need a direct connection to neon.

if any(cmd in sys.argv for cmd in("migrate", "makemigrations")):
    direct_url = os.getenv("DIRECT_URL")
    if direct_url:
        DATABASES["default"] =dj_database_url.parse(
            direct_url,
            conn_max_age=0,
            conn_health_checks = True,
            ssl_require = True,
        )

#--------------------------------------------------------------------------
#  Customer user model
#--------------------------------------------------------------------------
# Declared now(before the first migration) so  we never have to retrofit it.
AUTH_USER_MODEL ="api.User"

#-----------------------------------------------------------------------------
# Password validation
#-----------------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


#-----------------------------------------------------------------------------
# Internationalization
#-----------------------------------------------------------------------------

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Africa/NAirobi'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.1/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR/ "staticfiles"

MEDIA_URL ="/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD ="django.db.models.BigAutoField"


#--------------------------------------------------------------
# Django Rest Framework
#--------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES":[
        "rest_framework.authentication.SessionAuthentication",
    ],
    # Lock everything down by default; open up per view when needed.
   # "DEFAULT_AUTHENTICATION_CLASSEST_PERMISSION_CLASSES":[
   #     "rest_framework.permissions.IsAuthenticated",
   # ],

    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

#-------------------------------------------------------------------
# Cors -allow the nextjs dev server
#-------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

#session auth sends cookies; the browser requires this flg for cross-origin
CORS_ALLOW_CREDENTIALS = True

#CSRF: trust the Nextjs origin so POSTs from the frontend are accepted
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


# ---------------------------------------------------------------------------
# CSRF / Session cookies
# ---------------------------------------------------------------------------
# In development, frontend (:3000) and backend (:8000) are different origins.
# `Samesite=Lax` allows the cookie to be sent on top-level navigation but
# not on cross-site fetch — which is exactly what we want. In production
# (same parent domain), this stays correct.
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_HTTPONLY = True       # JS can't read sessionid
CSRF_COOKIE_HTTPONLY = False         # JS MUST read csrftoken to echo it


# Email
# https://docs.djangoproject.com/en/6.1/topics/email/#topic-email-configuration

MAILERS = {
    'default': {
        'BACKEND': 'django.core.mail.backends.console.EmailBackend',
    },
}
