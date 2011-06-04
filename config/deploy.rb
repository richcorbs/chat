require 'capistrano'

set :application, 'chat'
set :node_file, 'server.js'
set :host, '50.56.115.86'
set :user, 'deploy'
set :admin_user, 'deploy'
set :use_sudo, false
set :port, 7785

default_run_options[:pty] = true
set :repository, 'git@github.com:richcorbs/chat.git'
set :scm, 'git'
set :deploy_via, :remote_cache
set :deploy_to, "/u/chat"

role :app, host

set :keep_releases, 5

namespace :deploy do
  
  #desc "Symlink config files"
  #task :symlink_configs, :roles => :app do
  #  run "ln -sf #{shared_path}/config/#{f} #{release_path}/config/#{f}"
  #end

  task :restart, :roles => :app, :except => { :no_release => true } do
    run "sudo restart #{application}"
  end

end

