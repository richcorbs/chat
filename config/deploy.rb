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

after "deploy:update", "deploy:cleanup"

namespace :deploy do
  task :start, :roles => :app, :except => { :no_release => true } do
    run "sudo start #{application}_production"
  end

  task :stop, :roles => :app, :except => { :no_release => true } do
    run "sudo stop #{application}_production"
  end

  task :restart, :roles => :app, :except => { :no_release => true } do
    run "sudo restart #{application}_production || sudo start #{application}_production"
  end

  task :create_deploy_to_with_sudo, :roles => :app do
    run "sudo mkdir -p #{deploy_to}"
    run "sudo chown #{admin_runner}:#{admin_runner} #{deploy_to}"
  end

  task :write_upstart_script, :roles => :app do
    upstart_script = <<-UPSTART
  description "#{application}"

  start on startup
  stop on shutdown

  script
      # We found $HOME is needed. Without it, we ran into problems
      export HOME="/home/#{admin_runner}"
      export NODE_ENV="production"

      cd #{current_path}
      exec sudo -u #{admin_runner} sh -c "NODE_ENV=production /usr/local/bin/node #{current_path}/#{node_file} #{application_port} >> #{shared_path}/log/production.log 2>&1"
  end script
  respawn
UPSTART
  put upstart_script, "/tmp/#{application}_upstart.conf"
    run "sudo mv /tmp/#{application}_upstart.conf /etc/init/#{application}_production.conf"
  end

  task :create_deploy_to_with_sudo, :roles => :app do
    run "sudo mkdir -p #{deploy_to}"
    run "sudo chown #{admin_runner}:#{admin_runner} #{deploy_to}"
  end

end

before 'deploy:setup', 'deploy:create_deploy_to_with_sudo'
after 'deploy:setup', 'deploy:write_upstart_script'
